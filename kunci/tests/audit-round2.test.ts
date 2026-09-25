import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(__dirname, '..')
const read = (rel: string) => readFileSync(join(root, rel), 'utf8')
const strip = (s: string) => s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

const worker = strip(read('worker/index.ts'))
const daemon = read('helper/daemon.mjs')

/**
 * The second audit round (`deleg_7516cfee`) found faults that the first round's
 * tests did not cover. Each test below names the live symptom it locks down.
 */
describe('worker: OTP attempt cap is spent atomically', () => {
  it('increments the counter inside the Durable Object, not in the worker', () => {
    // Live before: ten concurrent wrong codes against a cap of 5 produced eight
    // "Kode salah" and two "Terlalu banyak percobaan" — eight evaluations were
    // accepted. get → compare → set in the worker cannot be serialized; the DO can.
    expect(worker).toContain("op: 'take-attempt'")
    expect(worker).toContain("storeFetch({ op: 'take-attempt', key: 'otp', max: OTP_MAX_ATTEMPTS })")
    expect(worker).not.toMatch(/if \(!ok\) \{\s*await setKey\('otp', \{ \.\.\.otp, attempts: otp\.attempts \+ 1 \}\)/)
  })

  it('the object checks the cap before incrementing', () => {
    const body = strip(read('worker/index.ts'))
    const fn = body.slice(body.indexOf("if (op === 'take-attempt')"))
    expect(fn).toContain('(rec.attempts ?? 0) >= (max ?? 0)')
    expect(fn).toContain('capped: true')
    expect(fn).toContain('attempts: (rec.attempts ?? 0) + 1')
  })
})

describe('daemon: /frontmost is authenticated and cached', () => {
  it('requires the helper token', () => {
    // It answered any local caller, and each call spawned an osascript: 400 parallel
    // unauthenticated requests spawned 349 processes and stalled /api/local-token.
    const route = daemon.slice(daemon.indexOf("url.pathname === '/frontmost'"))
    expect(route.slice(0, 400)).toContain("req.headers['x-kunci-token']")
    expect(route.slice(0, 400)).toContain('Token helper salah')
  })

  it('caches the osascript work', () => {
    expect(daemon).toContain("cached('frontmost'")
  })

  it('caches accessibilityTrusted on /health too', () => {
    // /health still called it uncached while /apps cached it: 120 parallel /health
    // requests forked 44 osascript processes.
    const health = daemon.slice(daemon.indexOf("url.pathname === '/health'"), daemon.indexOf("url.pathname === '/apps'"))
    expect(health).toContain("cached('ax'")
    expect(health).not.toContain('accessibility: await accessibilityTrusted()')
  })
})

describe('daemon: /fill answers 400 for a bad body instead of 500', () => {
  it('separates parse errors from server errors', () => {
    // Live before: body `this-is-not-json` → 500 with "Unexpected token 'h' … Di Mac:
    // izinkan Kunci Helper … Accessibility" (an accessibility hint for a parse
    // error), and body `null` → 500 "Cannot read properties of null".
    expect(daemon).toContain("json(res, 400, { ok: false, error: 'Body bukan JSON' })")
    expect(daemon).toContain("json(res, 400, { ok: false, error: 'Body harus objek JSON' })")
  })

  it('refuses to report ok:true when nothing can be typed', () => {
    // Body `42` answered 200 {"ok":true,...} while filling nothing.
    expect(daemon).toContain("json(res, 400, { ok: false, error: 'Password kosong' })")
    expect(daemon).toContain("const password = String(body.password || '')")
  })
})

describe('daemon: HEAD behaves like GET', () => {
  it('matches HEAD on the read routes', () => {
    // `curl -sI /health` answered 404 while `curl -s /health` answered 200.
    expect(daemon).toContain("(req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/health'")
    expect(daemon).toContain("(req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/frontmost'")
  })

  it('sends no body for HEAD', () => {
    expect(daemon).toContain("const head = res.req && res.req.method === 'HEAD'")
    expect(daemon).toContain('res.end(head ? undefined : JSON.stringify(body))')
  })
})

describe('daemon: only the Kunci UI ports may read the helper token', () => {
  it('rejects any other loopback port', () => {
    // Live before: `Origin: http://127.0.0.1:9999` read the token from
    // /api/local-token and then called POST /fill successfully.
    expect(daemon).toContain('const UI_PORTS = new Set([String(PORT), \'5173\', \'4173\'])')
    expect(daemon).toContain("return UI_PORTS.has(o.port || '80') ? origin : null")
  })
})

describe('daemon: --serve-ui is honoured', () => {
  it('reads the flag, not only the environment', () => {
    expect(daemon).toContain("process.argv.includes('--serve-ui')")
    expect(daemon).toContain("process.argv.includes('--no-serve-ui')")
  })
})

describe('extension id is the 32-character one a browser can produce', () => {
  it('has no 33-character id anywhere it is used as an origin', () => {
    // Chrome derives an unpacked extension's id from the folder path: always 32
    // characters. The shipped value had 33, so the daemon answered the extension's
    // own /health poll with 403 and the bridge was silently dead.
    const wrong = 'djiblgfjmjhjebgacdljbdoibbancniad'
    const right = 'djiblgfjmhjebgacdljbdoibbancniad'
    expect(wrong).toHaveLength(33)
    expect(right).toHaveLength(32)
    for (const rel of ['helper/daemon.mjs', 'src/lib/allowed-origins.ts']) {
      expect(read(rel), rel).not.toContain(wrong)
      expect(read(rel), rel).toContain(right)
    }
  })
})
