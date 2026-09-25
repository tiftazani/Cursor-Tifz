#!/usr/bin/env node
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { existsSync, createReadStream, statSync, readFileSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { extname, join } from 'node:path'
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises'

import {
  accessibilityTrusted,
  fillCredentials,
  frontmostName,
  helperAppBundlePath,
  helperBinPath,
  listGuiApps,
  promptAccessibility,
  revealHelperApp,
} from './mac-ax.mjs'
import { quitHelperProcesses } from './build-helper-app.mjs'
import { KUNCI_ROOT, extensionOnDisk, refreshCommands } from './repo-paths.mjs'

const ROOT = KUNCI_ROOT
const DIST = join(ROOT, 'dist')
const RECOVERY_EMAIL = 'tiftazani.khara@gmail.com'
const PORT = Number(process.env.KUNCI_PORT || 8780)
const TOKEN_DIR = join(homedir(), '.kunci')
const TOKEN_PATH = join(TOKEN_DIR, 'helper-token')
const RECOVERY_PATH = join(TOKEN_DIR, 'recovery.json')
const OTP_PATH = join(TOKEN_DIR, 'otp.json')
const CLOUD_ORIGIN = 'https://kunci.tiftazani-cuciin.workers.dev'
const serveUi =
  process.argv.includes('--serve-ui') || (process.env.KUNCI_SERVE_UI !== '0' && !process.argv.includes('--no-serve-ui'))

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

/** Origins that may talk to this daemon. Anything else is a web page, not Kunci. */
const LOOPBACK_ORIGINS = new Set([
  'http://127.0.0.1:8780',
  'http://localhost:8780',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
  'http://[::1]:8780',
  // The unpacked extension polls /health. Chrome derives the id of an unpacked
  // extension from the absolute path of its folder, so this is 32 characters and
  // matches `extension/` next to this file. It had 33 characters, which no browser
  // can ever produce: the extension's own health poll was answered 403.
  'chrome-extension://djiblgfjmhjebgacdljbdoibbancniad',
])

/**
 * Ports the Kunci UI may run on: the daemon itself, the dev server, the preview
 * server. `localOrigin` used to accept ANY loopback port, so any other local app
 * with a web view (a dev server the user happened to be running, an Electron app)
 * could read /api/local-token and then call POST /fill, which types credentials
 * from the vault into whatever app is in front.
 */
const UI_PORTS = new Set([String(PORT), '5173', '4173'])

/**
 * Whether an Origin header belongs to the local Kunci app.
 *
 * Reflecting whatever Origin arrives let any website the user visited read
 * /api/local-token (the helper token, which then opens POST /fill) and drive the
 * cloud proxy. Only loopback origins are echoed back; everything else gets no
 * CORS headers at all, so the browser refuses to hand the response to the page.
 */
function localOrigin(req) {
  const origin = req.headers.origin
  if (!origin) return null
  if (LOOPBACK_ORIGINS.has(origin)) return origin
  try {
    const o = new URL(origin)
    if (o.protocol === 'http:' && (o.hostname === '127.0.0.1' || o.hostname === 'localhost' || o.hostname === '[::1]')) {
      return UI_PORTS.has(o.port || '80') ? origin : null
    }
  } catch {
    return null
  }
  return null
}

function cors(req, res) {
  const origin = localOrigin(req)
  if (!origin) return
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Kunci-Token')
  // Only a verified loopback origin may skip the Private Network Access preflight.
  res.setHeader('Access-Control-Allow-Private-Network', 'true')
  res.setHeader('Vary', 'Origin')
}

async function ensureDir() {
  if (!existsSync(TOKEN_DIR)) await mkdir(TOKEN_DIR, { recursive: true, mode: 0o700 })
}

async function loadToken() {
  await ensureDir()
  if (existsSync(TOKEN_PATH)) return (await readFile(TOKEN_PATH, 'utf8')).trim()
  const token = randomBytes(24).toString('base64url')
  await writeFile(TOKEN_PATH, token, { mode: 0o600 })
  return token
}

/** The largest body any Kunci endpoint sends or forwards: a vault blob, not a file upload. */
const MAX_BODY_BYTES = 2 * 1024 * 1024

/**
 * Reads a request body, refusing anything oversized.
 *
 * The daemon listens on loopback, so without a cap a single POST (or a few in
 * parallel) can push it into swap and let launchd restart it mid-write. Measured
 * before this cap: one 64 MB body took RSS from 64 MB to 403 MB and it stayed.
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Body terlalu besar'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/**
 * Send a JSON reply, with no body for HEAD.
 *
 * Only GET was matched on these routes, so a monitor using HEAD got 404 for
 * endpoints that exist (`HEAD /health` → 404 while `GET /health` → 200). The
 * worker already treats HEAD like GET; the daemon did not.
 */
function json(res, status, body) {
  const head = res.req && res.req.method === 'HEAD'
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(head ? undefined : JSON.stringify(body))
}

async function wipeLegacyDek() {
  for (const path of [RECOVERY_PATH, OTP_PATH]) {
    if (existsSync(path)) {
      try {
        await unlink(path)
      } catch {
        /* ignore */
      }
    }
  }
}

function shouldProxyCloud(pathname) {
  if (pathname === '/kunci-status') return true
  if (!pathname.startsWith('/api/')) return false
  if (pathname === '/api/local-token') return false
  if (pathname.startsWith('/api/recovery')) return false
  return true
}

/** Plain Cloudflare Worker errors come back as JSON; anything else is a proxy problem. */
function workerError(status, body) {
  if (status !== 401 && status !== 403) return false
  const text = String(body || '').toLowerCase()
  return text.includes('<!doctype html') && text.includes('workers.dev')
}

async function proxyCloud(req, res, url) {
  try {
    const dest = `${CLOUD_ORIGIN}${url.pathname}${url.search}`
    // Forward the caller's real Origin. Rewriting it to the cloud origin made the
    // worker's allowlist meaningless for anything routed through the daemon.
    // A missing Origin means a non-browser caller (curl, a script); those cannot
    // be a web page, so the cloud origin stands in for them.
    const realOrigin = req.headers.origin
    const headers = {
      Origin: realOrigin || CLOUD_ORIGIN,
      Referer: `${realOrigin || CLOUD_ORIGIN}/`,
      Accept: 'application/json',
    }
    if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type']
    if (req.headers.authorization) headers.Authorization = req.headers.authorization
    if (req.headers.cookie) headers.Cookie = req.headers.cookie
    const init = { method: req.method, headers }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      init.body = await readBody(req)
    }
    const forwarded = await fetch(dest, init)
    const text = await forwarded.text()
    if (workerError(forwarded.status, text)) {
      console.error('Cloud Kunci menjawab halaman HTML, bukan JSON. Worker mungkin belum deploy.')
      json(res, 403, { error: 'Cloud Kunci tidak menjawab API. Coba lagi setelah deploy.' })
      return
    }
    const out = {
      'Content-Type': forwarded.headers.get('content-type') || 'application/json',
      'Cache-Control': 'no-store',
    }
    const cookies = typeof forwarded.headers.getSetCookie === 'function' ? forwarded.headers.getSetCookie() : []
    res.writeHead(forwarded.status, cookies.length ? { ...out, 'Set-Cookie': cookies } : out)
    res.end(text)
  } catch (err) {
    json(res, 502, {
      error: err instanceof Error ? `Gagal menghubungi cloud: ${err.message}` : 'Gagal menghubungi cloud',
    })
  }
}

function missingUiPage(res) {
  const cmd = refreshCommands().install
  res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(`<!doctype html>
<meta charset="utf-8">
<title>Kunci</title>
<body style="font:16px/1.45 -apple-system,sans-serif;background:#0a0d12;color:#eef3f8;padding:32px">
<h1>Kunci belum siap</h1>
<p>Layanan di port 8780 nyala, tapi tampilan belum di-build (<code>dist/index.html</code> tidak ada).</p>
<p>Di Terminal Mac:</p>
<pre style="background:#12171f;padding:12px 16px;border-radius:8px">${cmd}</pre>
<p>Lalu buka lagi <a href="/" style="color:#3ee0c3">http://127.0.0.1:8780</a></p>
<p style="color:#8b97a8">Atau pakai situs: <a href="https://kunci.tiftazani-cuciin.workers.dev" style="color:#3ee0c3">kunci.tiftazani-cuciin.workers.dev</a></p>
</body>`)
}

/**
 * Cached for a few seconds because it reads the whole 328 KB bundle and spawns git.
 * /health and /apps are reachable without a token from any page that can reach
 * loopback, so calling it per request let a web page block the daemon's event loop
 * (readFileSync + spawnSync are synchronous) just by looping.
 */
const MEMO_MS = 5000
const memo = new Map()

async function cached(key, produce) {
  const hit = memo.get(key)
  const now = Date.now()
  if (hit && now - hit.at < MEMO_MS) return hit.value
  const value = await produce()
  memo.set(key, { at: now, value })
  return value
}

function distMissingRingkasan() {
  const htmlPath = join(DIST, 'index.html')
  const srcDash = join(ROOT, 'src', 'views', 'DashboardView.tsx')
  if (!existsSync(htmlPath) || !existsSync(srcDash)) return false
  try {
    const html = readFileSync(htmlPath, 'utf8')
    const match = html.match(/src="(\/?assets\/index-[^"]+\.js)"/)
    if (!match) return true
    const jsPath = join(DIST, match[1].replace(/^\//, ''))
    if (!existsSync(jsPath)) return true
    const js = readFileSync(jsPath, 'utf8')
    return !js.includes('Ringkasan') && !js.includes('Keadaan akun')
  } catch {
    return false
  }
}

function staleUiPage(res) {
  const { pull, install } = refreshCommands()
  const cmd = `${pull} && ${install}`
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(`<!doctype html>
<meta charset="utf-8">
<title>Kunci</title>
<body style="font:16px/1.45 -apple-system,sans-serif;background:#0a0d12;color:#eef3f8;padding:32px">
<h1>Tampilan localhost masih yang lama</h1>
<p>Helper di port 8780 nyala, tapi file <code>dist/</code> belum di-build ulang. Git pull saja tidak mengganti halaman ini.</p>
<p>Kalau git bilang <code>origin/cursor/... is not a commit</code>: jangan checkout <code>origin/branch</code>. Clone single-branch cuma nulis commit ke <code>FETCH_HEAD</code>. Paste blok di bawah — pakai <code>&amp;&amp;</code>, jangan <code>;</code> supaya npm tidak jalan setelah git gagal.</p>
<p>Di Terminal Mac:</p>
<pre style="background:#12171f;padding:12px 16px;border-radius:8px;white-space:pre-wrap">${cmd}</pre>
<p>Lalu hard-refresh <a href="/" style="color:#3ee0c3">http://127.0.0.1:8780</a>. Sidebar harus tertulis <strong>Ringkasan · ${extensionOnDisk().extensionVersion}</strong>, bukan daftar password di depan.</p>
</body>`)
}

function serveStatic(req, res) {
  const head = req.method === 'HEAD'
  const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname
  if (pathname.startsWith('/api/') || pathname === '/kunci-status') return false
  if (!serveUi || !existsSync(DIST)) return false
  let path = new URL(req.url || '/', 'http://127.0.0.1').pathname
  if (path === '/') path = '/index.html'
  if ((path === '/' || path === '/index.html') && distMissingRingkasan()) {
    staleUiPage(res)
    return true
  }
  const file = join(DIST, path)
  if (!file.startsWith(DIST)) return false
  if (!existsSync(file) || statSync(file).isDirectory()) {
    const fallback = join(DIST, 'index.html')
    if (distMissingRingkasan()) {
      staleUiPage(res)
      return true
    }
    res.writeHead(200, { 'Content-Type': MIME['.html'] })
    if (head) res.end()
    else createReadStream(fallback).pipe(res)
    return true
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' })
  if (head) res.end()
  else createReadStream(file).pipe(res)
  return true
}

const token = await loadToken()
await wipeLegacyDek()
if (platform() === 'darwin') await quitHelperProcesses()
const server = createServer(async (req, res) => {
  cors(req, res)
  // A request that carries an Origin we do not recognise is a page we did not write.
  // CORS only stops it from READING the answer; it does not stop the answer from
  // being sent, and curl proved it: /api/local-token handed the helper token to
  // `Origin: https://evil.example`. Refuse the request instead of hiding the reply.
  // No Origin at all means a script or a native app (curl, the helper itself), which
  // cannot be a web page.
  const origin = req.headers.origin
  if (origin && !localOrigin(req)) {
    json(res, 403, { error: 'Origin tidak dikenal' })
    return
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`)
  try {
    if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/health') {
      const disk = await cached('extensionOnDisk', async () => extensionOnDisk())
      const stale = await cached('distStale', async () => distMissingRingkasan())
      json(res, 200, {
        ok: true,
        platform: platform(),
        version: disk.extensionVersion,
        email: RECOVERY_EMAIL,
        ui: serveUi,
        uiBuilt: existsSync(join(DIST, 'index.html')),
        uiRevision: stale ? 'stale' : disk.extensionVersion,
        accessibility: await cached('ax', async () => accessibilityTrusted()),
        helperApp: Boolean(helperBinPath()),
        helperAppPath: helperAppBundlePath() || '',
        ...(await cached('refreshCommands', async () => refreshCommands())),
      })
      return
    }
    if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/apps') {
      json(res, 200, {
        ok: true,
        platform: platform(),
        accessibility: await cached('ax', async () => accessibilityTrusted()),
        helperApp: Boolean(helperBinPath()),
        helperAppPath: helperAppBundlePath() || '',
        apps: await cached('apps', async () => listGuiApps()),
      })
      return
    }
    if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/api/local-token') {
      json(res, 200, { token, email: RECOVERY_EMAIL })
      return
    }
    if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/frontmost') {
      const provided = String(req.headers['x-kunci-token'] || '')
      if (provided !== token) {
        json(res, 401, { ok: false, error: 'Token helper salah' })
        return
      }
      // One osascript per caller was fine; 400 parallel callers spawned 349
      // `osascript` processes and left /api/local-token waiting 62 ms behind them.
      // There is no token on this route before, so any local process could start it.
      json(res, 200, { app: await cached('frontmost', async () => frontmostName()) })
      return
    }
    if (req.method === 'POST' && url.pathname === '/reveal-helper') {
      const provided = String(req.headers['x-kunci-token'] || '')
      if (provided !== token) {
        json(res, 401, { ok: false, error: 'Token helper salah' })
        return
      }
      json(res, 200, await revealHelperApp())
      return
    }
    if (req.method === 'POST' && url.pathname === '/accessibility/prompt') {
      const provided = String(req.headers['x-kunci-token'] || '')
      if (provided !== token) {
        json(res, 401, { ok: false, error: 'Token helper salah' })
        return
      }
      json(res, 200, await promptAccessibility())
      return
    }
    if (req.method === 'POST' && url.pathname === '/fill') {
      const provided = String(req.headers['x-kunci-token'] || '')
      if (provided !== token) {
        json(res, 401, { ok: false, error: 'Token helper salah' })
        return
      }
      // A body that is not a JSON object is a caller bug, not a server error. This
      // used to sit inside the route try, so `this-is-not-json` answered 500 with
      // "Unexpected token 'h' … Di Mac: izinkan Kunci Helper di System Settings"
      // (an Accessibility message for a parsing problem), and `null` answered 500
      // with "Cannot read properties of null". `42` even answered ok:true while
      // typing nothing, because `(42).username` is undefined and no field got filled.
      let body
      try {
        body = JSON.parse((await readBody(req)) || '{}')
      } catch {
        json(res, 400, { ok: false, error: 'Body bukan JSON' })
        return
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        json(res, 400, { ok: false, error: 'Body harus objek JSON' })
        return
      }
      const mode = body.mode === 'password' ? 'password' : 'login'
      const username = String(body.username || '')
      const password = String(body.password || '')
      if (!password) {
        json(res, 400, { ok: false, error: 'Password kosong' })
        return
      }
      const result = await fillCredentials({
        username,
        password,
        mode,
        appName: String(body.appName || ''),
        waitMs: Number(body.waitMs || 0),
      })
      json(res, 200, { ok: true, method: result.method, app: result.app || null })
      return
    }
    if (
      req.method === 'POST' &&
      (url.pathname === '/api/recovery/register' ||
        url.pathname === '/api/recovery/request' ||
        url.pathname === '/api/recovery/confirm')
    ) {
      await wipeLegacyDek()
      json(res, 410, {
        ok: false,
        error: 'Reset memakai recovery key di layar Kunci. Helper tidak lagi menyimpan DEK di disk.',
      })
      return
    }
    if (shouldProxyCloud(url.pathname)) {
      await proxyCloud(req, res, url)
      return
    }
    if ((req.method === 'GET' || req.method === 'HEAD') && serveStatic(req, res)) return
    if (
      (req.method === 'GET' || req.method === 'HEAD') &&
      serveUi &&
      (url.pathname === '/' || url.pathname === '/index.html') &&
      !existsSync(join(DIST, 'index.html'))
    ) {
      missingUiPage(res)
      return
    }
    json(res, 404, { ok: false, error: 'not found' })
  } catch (err) {
    json(res, 500, {
      ok: false,
      error:
        err instanceof Error
          ? `${err.message}. Di Mac: izinkan Kunci Helper di System Settings → Privacy & Security → Accessibility.`
          : 'gagal',
    })
  }
})

/**
 * Without this, a second copy of the daemon (or anything else already on 8780) makes
 * listen() emit 'error', and an unhandled 'error' event on a server crashes the process
 * with a stack trace. Under launchd with KeepAlive that becomes a restart loop, so the
 * message has to say what actually happened and exit cleanly instead.
 */
server.on('error', (err) => {
  const code = err && err.code
  if (code === 'EADDRINUSE') {
    console.error(`Port ${PORT} sudah dipakai proses lain. Hentikan dulu, atau jalankan ulang layanan.`)
  } else {
    console.error(`Layanan tidak bisa jalan: ${err && err.message ? err.message : err}`)
  }
  process.exit(1)
})

server.listen(PORT, '127.0.0.1', () => {
  const hasUi = existsSync(join(DIST, 'index.html'))
  console.log(`Kunci layanan http://127.0.0.1:${PORT}${serveUi && hasUi ? ' (UI + API)' : ' (API)'}`)
  if (serveUi && !hasUi) {
    console.log('Tampilan belum ada. Di folder kunci jalankan: npm install && npm run install-service')
  }
})
