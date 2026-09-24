import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(__dirname, '..')
const worker = readFileSync(join(root, 'worker/index.ts'), 'utf8')
const daemon = readFileSync(join(root, 'helper/daemon.mjs'), 'utf8')
const strip = (s: string) => s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

/**
 * The rate window used to be anchored on the last request instead of on its own start,
 * so a caller who came back more often than windowMs never saw it expire. Simulated
 * with 4/hour and one request every 55 minutes, the old shape blocked 25 of 30 requests
 * across 27 hours. This mirrors the shipped arithmetic and locks the fixed-window shape.
 */
function rate(store: { n?: number; start?: number }, now: number, max: number, windowMs: number) {
  const expired = !store.start || now - store.start >= windowMs
  const n = (expired ? 0 : store.n ?? 0) + 1
  return { n, start: expired ? now : store.start, ok: n <= max }
}

describe('worker rate limiter', () => {
  // Realistic clock: Date.now() is never 0, and `!rl.start` would read a 0 start as
  // "no window yet". Using a real epoch base keeps the test honest about that.
  const BASE = 1_760_000_000_000

  it('lets a steady caller through after the window expires', () => {
    let store: { n?: number; start?: number } = {}
    let allowed = 0
    let now = BASE
    for (let i = 0; i < 30; i++) {
      const r = rate(store, now, 4, 60 * 60 * 1000)
      store = r
      if (r.ok) allowed++
      now += 55 * 60 * 1000
    }
    // 30 requests spread over 27 hours against a 4-per-hour limit: every one is legal.
    expect(allowed).toBe(30)
  })

  it('still blocks the fifth request inside one window', () => {
    let store: { n?: number; start?: number } = {}
    const results = [0, 1, 2, 3, 4].map((i) => {
      store = rate(store, BASE + i * 1000, 4, 60 * 60 * 1000)
      return store.ok
    })
    expect(results).toEqual([true, true, true, true, false])
  })

  it('anchors the window on its first request, not the newest one', () => {
    // Two requests 59 minutes apart must share the window that started with the first.
    let store: { n?: number; start?: number } = {}
    store = rate(store, BASE, 1, 60 * 60 * 1000)
    const second = rate(store, BASE + 59 * 60 * 1000, 1, 60 * 60 * 1000)
    expect(second.ok).toBe(false)
    expect(second.start).toBe(BASE)
  })

  it('shipped code uses the start-anchored window', () => {
    const body = strip(worker)
    expect(body).toContain('now - rl.start >=')
    expect(body).not.toMatch(/rl\.t\s*&&\s*rl\.t\s*>/)
  })
})

describe('worker request parsing', () => {
  it('treats an undecodable cookie as no cookie instead of throwing', () => {
    // `kunci_session=%` used to throw URIError, and the outer catch answered 500 with
    // the raw message; src/lib/cloud.ts reads 500-with-JSON as "the API is alive".
    const body = strip(worker)
    const fn = body.slice(body.indexOf('function readCookie'))
    expect(fn).toContain('try {')
    expect(fn).toContain('catch {')
    expect(fn).toContain('return null')
  })

  it('coerces the claimed email before comparing it', () => {
    // `email: 123` used to throw a TypeError reported as 500 with the internal message.
    const body = strip(worker)
    expect(body).toContain('String(body.email ?? ALLOWED_EMAIL).trim().toLowerCase()')
    expect(body).not.toMatch(/\(body\.email \|\| ALLOWED_EMAIL\)\.toLowerCase\(\)/)
  })

  it('issues and clears the session cookie through one function', () => {
    // The clear was a hardcoded string with `Secure` while issueSession only added
    // `Secure` over https, so on http the two attribute sets disagreed.
    const body = strip(worker)
    expect(body).toContain('function sessionCookie(')
    expect(body).toContain("sessionCookie(req, '', 0)")
    expect(body).not.toMatch(/Set-Cookie':\s*`\$\{COOKIE\}=; Path=\/; HttpOnly; Secure/)
  })
})

describe('worker origin gate', () => {
  it('refuses local-helper paths instead of answering 404', () => {
    // 404 for /api/health on the cloud worker read as "the API is fine, wrong path".
    const body = strip(worker)
    expect(body).toContain("path === '/api/health'")
    expect(body).toContain("path === '/api/local-token'")
    expect(body).toContain("respond({ error: 'Tidak di worker ini' }, 403)")
  })

  it('has no User-Agent back door', () => {
    // `ua.startsWith('Kunci-local/')` let anyone POST past the origin gate by setting
    // a header. Verified live before the fix: POST with that UA → 404 (through the
    // gate), without it → 403.
    expect(strip(worker)).not.toContain('Kunci-local/')
  })
})

describe('worker HEAD parity', () => {
  it('treats HEAD like GET instead of answering 404', () => {
    // Verified live before: HEAD /api/me → 404 while GET /api/me → 401, so a monitor
    // using HEAD saw "not found" for an endpoint that exists.
    const body = strip(worker)
    expect(body).toContain("(req.method === 'GET' || req.method === 'HEAD') && isSessionPath(path)")
    expect(body).toMatch(/req\.method === 'GET' \|\| req\.method === 'HEAD'\) \{\s*return respond\(\{ blob:/)
    expect(body).toContain("}, req.method === 'HEAD')")
  })

  it('sends no body for HEAD', () => {
    expect(strip(worker)).toContain('head ? null : JSON.stringify(body)')
  })
})

describe('worker error responses', () => {
  it('does not return the internal error message to the client', () => {
    // Live before: `{"email":123}` answered 500 with
    // "(body.email || ALLOWED_EMAIL).toLowerCase is not a function".
    const body = strip(worker)
    expect(body).toContain("respond({ error: 'Server error' }, 500)")
    expect(body).not.toMatch(/const message = err instanceof Error \? err\.message/)
  })
})

describe('helper daemon hardening', () => {
  it('caps the request body', () => {
    expect(daemon).toContain('MAX_BODY_BYTES')
    expect(daemon).toContain('Body terlalu besar')
  })

  it('handles a listen error instead of crashing under launchd', () => {
    // An unhandled 'error' on the server crashes the process; with KeepAlive that is a
    // restart loop with no explanation.
    expect(daemon).toContain("server.on('error'")
    expect(daemon).toContain('EADDRINUSE')
  })

  it('caches the unauthenticated /health and /apps work', () => {
    // Both are reachable without a token from any page that can reach loopback, and
    // each call read the whole bundle and spawned git/osascript synchronously.
    expect(daemon).toContain('const MEMO_MS = 5000')
    expect(daemon).toContain("cached('extensionOnDisk'")
    expect(daemon).toContain("cached('apps'")
    expect(daemon).toContain("cached('ax'")
  })

  it('refuses a foreign Origin at the source', () => {
    expect(daemon).toContain('Origin tidak dikenal')
    expect(daemon).toContain('LOOPBACK_ORIGINS')
  })
})
