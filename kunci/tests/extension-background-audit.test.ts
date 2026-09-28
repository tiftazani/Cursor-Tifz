import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dekToB64, persistVault } from '../extension/crypto.js'

/**
 * Findings B4, B9, B12, B13 from the extension audit (2026-09-25).
 *
 * These run the REAL extension/background.js against a chrome stub. background.js is
 * an ES module and registers its listeners at module scope, so the stub has to exist
 * before the import — hence the dynamic import with a fresh module registry each time.
 */

type Listener = (msg: unknown, sender: unknown, sendResponse: (r: unknown) => void) => unknown

/** A real encrypted blob, so the decrypt path is exercised rather than stubbed. */
async function realBlob(vault: unknown, dekRaw: Uint8Array) {
  return persistVault(vault as never, dekRaw as never, {
    v: 2,
    iv: '',
    data: '',
    savedAt: 0,
  } as never)
}

function makeChrome() {
  const sessionData: Record<string, unknown> = {}
  const localData: Record<string, unknown> = {}
  const listeners: Listener[] = []
  const reloads: number[] = []
  const chrome = {
    storage: {
      session: {
        get: async (keys: string | string[]) => {
          const names = Array.isArray(keys) ? keys : [keys]
          const out: Record<string, unknown> = {}
          for (const k of names) if (k in sessionData) out[k] = sessionData[k]
          return out
        },
        set: async (obj: Record<string, unknown>) => {
          Object.assign(sessionData, obj)
        },
        remove: async (keys: string | string[]) => {
          for (const k of Array.isArray(keys) ? keys : [keys]) delete sessionData[k]
        },
      },
      local: {
        get: async (keys: string | string[]) => {
          const names = Array.isArray(keys) ? keys : [keys]
          const out: Record<string, unknown> = {}
          for (const k of names) if (k in localData) out[k] = localData[k]
          return out
        },
        set: async (obj: Record<string, unknown>) => {
          Object.assign(localData, obj)
        },
      },
    },
    runtime: {
      onMessage: { addListener: (fn: Listener) => listeners.push(fn) },
      onStartup: { addListener: () => undefined },
      onInstalled: { addListener: () => undefined },
      reload: () => reloads.push(-1),
      getManifest: () => ({ version: '1.4.10' }),
    },
    tabs: {
      query: async () => [],
      sendMessage: async () => undefined,
      onRemoved: { addListener: () => undefined },
      reload: async (id: number) => {
        reloads.push(id)
      },
    },
    scripting: {
      executeScript: async () => [{ result: false }],
      insertCSS: async () => undefined,
    },
    commands: { onCommand: { addListener: () => undefined } },
    alarms: { create: () => undefined, onAlarm: { addListener: () => undefined } },
  }
  return { chrome, sessionData, localData, listeners, reloads }
}

async function loadBackground(harness: ReturnType<typeof makeChrome>) {
  vi.resetModules()
  ;(globalThis as unknown as { chrome: unknown }).chrome = harness.chrome
  await import('../extension/background.js')
  return harness.listeners[0]!
}

/** Ask the background script something and resolve with its answer. */
function ask(listener: Listener, msg: unknown, tabId = 1): Promise<unknown> {
  return new Promise((resolve) => {
    const sender = { tab: { id: tabId } }
    listener(msg, sender, resolve)
  })
}

const DEK = new Uint8Array(32).fill(7)

describe('background.js vault writes', () => {
  let harness: ReturnType<typeof makeChrome>
  let listener: Listener

  beforeEach(async () => {
    harness = makeChrome()
    listener = await loadBackground(harness)
  })

  async function unlock(vault: { entries: unknown[]; settings: Record<string, unknown> }) {
    const blob = await realBlob(vault, DEK)
    harness.localData.blob = blob
    const res = await ask(listener, { type: 'UNLOCKED', vault, dekB64: dekToB64(DEK) })
    expect(res).toMatchObject({ ok: true })
    return blob
  }

  // B13: the decrypted vault used to live in chrome.storage.session, which is capped at
  // 10 MB. A big vault blew the quota, session.set threw, and every later read came
  // back empty — MATCHES then answered `locked: true` while the vault was open.
  it('never puts the plaintext vault in session storage', async () => {
    await unlock({ entries: [{ id: 'e1', type: 'login', name: 'A', password: 'p1', url: 'https://a.com' }], settings: {} })
    expect(harness.sessionData.vault).toBeUndefined()
    expect(harness.sessionData.unlocked).toBe(true)
    expect(typeof harness.sessionData.dekB64).toBe('string')
  })

  it('keeps answering while the vault is open', async () => {
    await unlock({ entries: [{ id: 'e1', type: 'login', name: 'A', password: 'p1', url: 'https://a.com' }], settings: {} })
    const status = await ask(listener, { type: 'STATUS' })
    expect(status).toMatchObject({ unlocked: true, count: 1 })
    const matches = await ask(listener, { type: 'MATCHES', url: 'https://a.com/login' })
    expect(matches).toMatchObject({ locked: false })
  })

  // B9: a note has no password and cannot be filled. It was listed and clickable in the
  // popup, so choosing one sent FILL_ENTRY with an empty password and closed the popup.
  it('never lists a note in SEARCH', async () => {
    await unlock({
      entries: [
        { id: 'n1', type: 'note', name: 'Catatan Pelindo', notes: 'pelindo stuff' },
        { id: 'l1', type: 'login', name: 'Pelindo Login', username: 'tif', password: 'p', url: 'https://pelindo.co.id' },
      ],
      settings: {},
    })
    const res = (await ask(listener, { type: 'SEARCH', query: 'pelindo' })) as { entries: { id: string }[] }
    expect(res.entries.map((e) => e.id)).toEqual(['l1'])
  })

  // B12: two tabs pressing Simpan at once both read the same vault and the second write
  // dropped the first entry, while both answered {ok:true, changed:'create'}.
  it('serialises two SAVE_LOGIN calls so neither entry is lost', async () => {
    await unlock({ entries: [{ id: 'base', type: 'login', name: 'Base', password: 'p', url: 'https://base.com' }], settings: {} })
    const captureA = { url: 'https://site-a.com', username: 'a', password: 'pa', submittedUrl: 'https://site-a.com' }
    const captureB = { url: 'https://site-b.com', username: 'b', password: 'pb', submittedUrl: 'https://site-b.com' }
    const [ra, rb] = await Promise.all([
      ask(listener, { type: 'SAVE_LOGIN', capture: captureA }, 1),
      ask(listener, { type: 'SAVE_LOGIN', capture: captureB }, 2),
    ])
    expect(ra).toMatchObject({ ok: true })
    expect(rb).toMatchObject({ ok: true })
    // Three entries means neither save overwrote the other. The old code produced two.
    expect(await ask(listener, { type: 'STATUS' })).toMatchObject({ count: 3 })
    const matches = (await ask(listener, { type: 'MATCHES', url: 'https://site-a.com/login' })) as { matches: { name: string }[] }
    expect(matches.matches.map((m) => m.name)).toContain('Site-a')
  })

  // B4: the save bar never appeared because the destination page read the pending save
  // before the write landed. The write is queued and answered immediately (the sender is
  // a page that is unloading, so waiting for it buys nothing); the READER retries, which
  // is what restorePendingSave in content.js now does. Both halves are asserted here: a
  // single read loses the race, and a retrying read wins it.
  it('loses the pending save on a single read but wins with the retry the reader now does', async () => {
    await unlock({ entries: [], settings: {} })
    const capture = { url: 'https://site.com', username: 'u', password: 'p', submittedUrl: 'https://site.com' }
    const queued = ask(listener, { type: 'QUEUE_SAVE', capture }, 7)

    // The old reader: one look, then give up. This is the race the audit measured.
    const single = (await ask(listener, { type: 'GET_PENDING_SAVE' }, 7)) as { pending: unknown }
    expect(single.pending).toBeNull()

    // The new reader: up to 6 further attempts 150 ms apart.
    let res = (await ask(listener, { type: 'GET_PENDING_SAVE' }, 7)) as { pending: { capture?: unknown } | null }
    for (let i = 0; i < 6 && !res.pending?.capture; i++) {
      await new Promise((r) => setTimeout(r, 20))
      res = (await ask(listener, { type: 'GET_PENDING_SAVE' }, 7)) as { pending: { capture?: unknown } | null }
    }
    expect(res.pending?.capture).toBeTruthy()
    await queued
  })

  // A stale cloud token in session storage was sent as `Authorization: Bearer …`,
  // and the worker reads `bearer || cookie` — so the dead header shadowed the live
  // cookie the extension's own fetch carries. The vault never reached the cloud and
  // the failure was swallowed. The write now retries without the header.
  it('retries a cloud push without a stale token', async () => {
    await unlock({ entries: [], settings: {} })
    harness.sessionData.cloudToken = 'token-from-an-older-secret'
    const seen: { url: string; auth: string | null; credentials: string | undefined }[] = []
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      seen.push({
        url: String(url),
        auth: new Headers(init?.headers).get('authorization'),
        credentials: init?.credentials,
      })
      return init?.headers && new Headers(init.headers).get('authorization')
        ? new Response(JSON.stringify({ error: 'Sesi tidak valid' }), { status: 401 })
        : new Response(JSON.stringify({ ok: true }), { status: 200 })
    })
    try {
      await ask(listener, { type: 'SAVE_LOGIN', capture: { url: 'https://x.com', username: 'u', password: 'p' } }, 3)
      // Only the vault PUT counts. Importing background.js runs startExtensionSync(),
      // which calls the local helper's /health, and `vi.resetModules()` in
      // loadBackground makes that happen again for every test in this file — so the
      // first entry in `seen` is that health check, not the push. Asserting on
      // `seen[0]` only ever passed because some other test file happened to leave
      // state behind that skipped the health call; standalone it failed 3 runs out of 3.
      const pushes = seen.filter((s) => s.url.endsWith('/api/vault'))
      expect(pushes).toHaveLength(2)
      expect(pushes[0]!.auth).toMatch(/^Bearer /)
      expect(pushes[1]!.auth).toBeNull()
      // Without `credentials: 'include'` a cross-origin fetch from the extension
      // carries no cookie, so the retry would have no credential to fall back on and
      // the stale header would be the only thing it ever tried.
      expect(pushes[0]!.credentials).toBe('include')
      expect(pushes[1]!.credentials).toBe('include')
      // The dead token is cleared, so the next push does not repeat the mistake.
      expect(harness.sessionData.cloudToken).toBe('')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
