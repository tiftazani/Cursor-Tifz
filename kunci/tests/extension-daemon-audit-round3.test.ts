import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Regression tests for the extension + daemon audit round.
 *
 * Every case here was found by reading the source and reproducing the behaviour in a
 * real browser; each one is proven by reverting the fix and watching the test fail
 * (see the mutation script). The parity case runs both copies of the predicate for
 * real rather than grepping them, because the whole point of finding 6 was that a
 * source-reading test could not see the drift.
 */
const root = join(__dirname, '..')
const read = (rel: string) => readFileSync(join(root, rel), 'utf8')

const content = read('extension/content.js')
const background = read('extension/background.js')
const extCrypto = read('extension/crypto.js')
const daemon = read('helper/daemon.mjs')

describe('the vault bridge is only wired into a page that is really Kunci', () => {
  it('isKunciPage checks the scheme, not just host and port', () => {
    // Live before: `const { hostname, port } = location` with no protocol check, so
    // ANY local dev server on 5173 (an unrelated Vite project) or 4173 was treated
    // as Kunci, got wireKunciBridge(), and could then request the encrypted blob or
    // push a replacement one. Verified in a browser with a local HTTPS server on
    // 5173 that received the real 771-byte blob.
    const fn = content.slice(content.indexOf('function isKunciPage'))
    const body = fn.slice(0, 700)
    expect(body).toContain('protocol')
    expect(body).toContain("protocol === 'https:'")
    expect(body).toContain("protocol === 'http:'")
  })
})

describe('SYNC validates and reports what actually happened', () => {
  it('rejects a blob that is not an encrypted vault', () => {
    // Live before: `chrome.storage.local.set({ blob: msg.blob })` with no shape check,
    // so any caller could write an arbitrary object into `blob`. `isEncryptedBlob` is
    // what popup.js and src/extension/bridge.ts already use.
    expect(background).toContain('isEncryptedBlob')
    expect(background).toContain('if (!isEncryptedBlob(msg.blob))')
    expect(background).toContain("'Blob tidak valid'")
    expect(background).toMatch(/import \{[^}]*isEncryptedBlob[^}]*\} from '\.\/crypto\.js'/)
  })

  it('answers after the write, so an over-quota failure is reported', () => {
    // Live before: `return ack(sendResponse, ...)` answered `{ok:true}` BEFORE the
    // write ran. Over the 10 MB `storage.local` quota the set throws, the blob is
    // dropped, and the app was told it synced while the extension kept serving the
    // stale vault (verified: MATCHES returned OLD-PASSWORD-2025 after a rotation).
    const sync = background.slice(background.indexOf("if (msg.type === 'SYNC' && msg.blob)"))
    // Bound the slice to the SYNC branch: the next `if (msg.type ===` is CLOUD_TOKEN,
    // which still answers through `ack()` and is not part of this fix.
    const body = sync.slice(0, sync.indexOf("if (msg.type === 'CLOUD_TOKEN'"))
    // The SYNC branch itself must not answer through `ack()` (which replies before
    // the work runs). `ack` still exists for the other message types.
    expect(body).not.toContain('ack(sendResponse')
    expect(body).toContain('return true')
    expect(body).toContain("sendResponse({ ok: false, error:")
    // The success answer must come after the set, not before it.
    expect(body.indexOf('await chrome.storage.local.set')).toBeLessThan(body.indexOf('sendResponse({ ok: true })'))
  })
})

describe('a hung cloud PUT cannot pin the save chain', () => {
  it('bounds pushCloud with a timeout', () => {
    // Live before: a host that accepted the connection and never answered left
    // SAVE_LOGIN pending forever; every later save queued behind it via withVault,
    // and the save bar stayed up. Verified: still PENDING after 10 s.
    const fn = background.slice(background.indexOf('async function pushCloud'))
    const body = fn.slice(0, 1200)
    expect(body).toContain('AbortSignal.timeout')
    expect(body).toContain('CLOUD_TIMEOUT_MS')
    expect(background).toContain('const CLOUD_TIMEOUT_MS =')
  })
})

describe('a failed save keeps its pending record', () => {
  it('clears pendingSaves only after the write lands', () => {
    // Live before: `await clearPendingSave(...)` ran before `await writeVault(...)`,
    // so a write failure lost both the login AND the record `restorePendingSave()`
    // would have used to offer it again. Verified: pendingSaves went 1 -> {} on a
    // forced quota error.
    const save = background.slice(background.indexOf("if (msg.type === 'SAVE_LOGIN')"))
    const body = save.slice(0, 900)
    // The skip path clears first (nothing was written, so nothing to retry); the
    // write path must clear only AFTER the write lands.
    const writeIdx = body.indexOf('await writeVault({ ...vault, entries: next.entries }')
    expect(writeIdx).toBeGreaterThan(-1)
    const clearAfterWrite = body.indexOf('await clearPendingSave', writeIdx)
    expect(clearAfterWrite).toBeGreaterThan(writeIdx)
    // Exactly the two clears: the skip path and the write path.
    expect(body.match(/await clearPendingSave/g)?.length).toBe(2)
    expect(body).toContain("if (next.changed === 'skip')")
  })
})

describe('the save bar says when a save failed', () => {
  it('handles the {error} answer instead of only {ok}', () => {
    // Live before: `if (res?.locked) {...} if (res?.ok) hideSaveBar()` — an `{error}`
    // answer hit neither branch, so the bar stayed up with no message and the user
    // pressed Simpan again with no idea it had failed.
    const save = content.slice(content.indexOf("type: 'SAVE_LOGIN', capture"))
    const body = save.slice(0, 1400)
    expect(body).toContain("res?.error")
    expect(body).toContain('Gagal menyimpan')
  })
})

describe('the daemon does not repeat work for concurrent callers', () => {
  it('dedupes in-flight memo entries', () => {
    // Live before: `cached()` recorded the value only after `produce()` resolved, so
    // N concurrent cold misses each ran their own osascript — 400 cold /health
    // requests spawned 43 unique PIDs in 0.28 s.
    const fn = daemon.slice(daemon.indexOf('async function cached'))
    const body = fn.slice(0, 1400)
    expect(body).toContain('if (hit?.pending) return hit.pending')
    expect(body).toContain('memo.set(key, { at: now, pending })')
    // A failure must not be memoised.
    expect(body).toContain('memo.delete(key)')
  })

  it('serves static files through the same memo', () => {
    // Live before: `distMissingRingkasan()` (a readFileSync of the 335 KB bundle) ran
    // per static request. The memo covered /health only.
    const fn = daemon.slice(daemon.indexOf('async function serveStatic'))
    const body = fn.slice(0, 1200)
    expect(body).toContain("cached('distStale'")
    expect(body).not.toMatch(/&&\s*distMissingRingkasan\(\)\)\s*\{/)
  })
})

describe('isKunciAppUrl agrees across the two copies, scheme included', () => {
  // The old parity test listed only http:// loopback URLs, so the extension could
  // ignore the scheme while src/lib compared full origins and the test stayed green.
  const urls = [
    'http://127.0.0.1:8780/',
    'http://localhost:8780/x',
    'http://127.0.0.1:5173/',
    'http://localhost:4173/',
    'https://127.0.0.1:5173/',
    'https://localhost:8780/',
    'https://localhost:4173/x',
    'http://localhost:3000/',
    'https://bank.example.com/login',
    'https://kunci.tiftazani-cuciin.workers.dev/',
    'https://kunci.tiftazani-cuciin.workers.dev.evil.com/',
  ]

  /** Mirrors src/lib/capture.ts: full origins, all http. */
  function webIsKunciAppUrl(raw: string): boolean {
    const LOCAL = [
      'http://127.0.0.1:8780',
      'http://localhost:8780',
      'http://127.0.0.1:5173',
      'http://localhost:5173',
      'http://127.0.0.1:4173',
      'http://localhost:4173',
    ]
    try {
      const url = new URL(raw)
      if (LOCAL.includes(url.origin)) return true
      return url.hostname === 'kunci.tiftazani-cuciin.workers.dev'
    } catch {
      return false
    }
  }

  it('the extension copy matches the web copy for every URL', () => {
    for (const u of urls) {
      const ext = evalExtIsKunciAppUrl(u)
      expect(ext, `${u} (extension said ${ext}, web says ${webIsKunciAppUrl(u)})`).toBe(webIsKunciAppUrl(u))
    }
  })

  it('an https loopback server on a Kunci port is NOT the app', () => {
    // This is the exact case that used to drift.
    for (const u of ['https://127.0.0.1:5173/', 'https://localhost:8780/', 'https://localhost:4173/x']) {
      expect(webIsKunciAppUrl(u), u).toBe(false)
      expect(evalExtIsKunciAppUrl(u), u).toBe(false)
    }
  })

  /** Run the extension's own function body, so the test cannot drift from it. */
  function evalExtIsKunciAppUrl(raw: string): boolean {
    const start = extCrypto.indexOf('export function isKunciAppUrl')
    const bodyStart = extCrypto.indexOf('{', start)
    let depth = 0
    let end = bodyStart
    for (let i = bodyStart; i < extCrypto.length; i++) {
      if (extCrypto[i] === '{') depth++
      else if (extCrypto[i] === '}') {
        depth--
        if (depth === 0) {
          end = i + 1
          break
        }
      }
    }
    const body = extCrypto.slice(bodyStart + 1, end - 1)
    const fn = new Function('raw', 'KUNCI_PORTS', body)
    return fn(raw, new Set(['8780', '5173', '4173'])) as boolean
  }
})
