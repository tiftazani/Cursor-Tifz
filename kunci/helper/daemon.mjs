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
import { KUNCI_ROOT, refreshCommands } from './repo-paths.mjs'

const ROOT = KUNCI_ROOT
const DIST = join(ROOT, 'dist')
const RECOVERY_EMAIL = 'tiftazani.khara@gmail.com'
const PORT = Number(process.env.KUNCI_PORT || 8780)
const TOKEN_DIR = join(homedir(), '.kunci')
const TOKEN_PATH = join(TOKEN_DIR, 'helper-token')
const RECOVERY_PATH = join(TOKEN_DIR, 'recovery.json')
const OTP_PATH = join(TOKEN_DIR, 'otp.json')
const serveUi = process.env.KUNCI_SERVE_UI !== '0'

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

function cors(req, res) {
  const origin = req.headers.origin || '*'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Kunci-Token')
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

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
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
</body>`)
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
<p>Lalu hard-refresh <a href="/" style="color:#3ee0c3">http://127.0.0.1:8780</a>. Sidebar harus tertulis <strong>Ringkasan · 1.3</strong>, bukan daftar password di depan.</p>
</body>`)
}

function serveStatic(req, res) {
  const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname
  if (pathname.startsWith('/api/')) return false
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
    createReadStream(fallback).pipe(res)
    return true
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' })
  createReadStream(file).pipe(res)
  return true
}

const token = await loadToken()
await wipeLegacyDek()
if (platform() === 'darwin') await quitHelperProcesses()
const server = createServer(async (req, res) => {
  cors(req, res)
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`)
  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      json(res, 200, {
        ok: true,
        platform: platform(),
        version: '1.4.3',
        email: RECOVERY_EMAIL,
        ui: serveUi,
        uiBuilt: existsSync(join(DIST, 'index.html')),
        uiRevision: distMissingRingkasan() ? 'stale' : '1.3',
        accessibility: await accessibilityTrusted(),
        helperApp: Boolean(helperBinPath()),
        helperAppPath: helperAppBundlePath() || '',
        ...refreshCommands(),
      })
      return
    }
    if (req.method === 'GET' && url.pathname === '/apps') {
      json(res, 200, {
        ok: true,
        platform: platform(),
        accessibility: await accessibilityTrusted(),
        helperApp: Boolean(helperBinPath()),
        helperAppPath: helperAppBundlePath() || '',
        apps: await listGuiApps(),
      })
      return
    }
    if (req.method === 'GET' && url.pathname === '/api/local-token') {
      json(res, 200, { token, email: RECOVERY_EMAIL })
      return
    }
    if (req.method === 'GET' && url.pathname === '/frontmost') {
      json(res, 200, { app: await frontmostName() })
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
      const body = JSON.parse((await readBody(req)) || '{}')
      const result = await fillCredentials({
        username: body.username || '',
        password: body.password || '',
        mode: body.mode || 'login',
        appName: body.appName || '',
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
    if (req.method === 'GET' && serveStatic(req, res)) return
    if (
      req.method === 'GET' &&
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

server.listen(PORT, '127.0.0.1', () => {
  const hasUi = existsSync(join(DIST, 'index.html'))
  console.log(`Kunci layanan http://127.0.0.1:${PORT}${serveUi && hasUi ? ' (UI + API)' : ' (API)'}`)
  if (serveUi && !hasUi) {
    console.log('Tampilan belum ada. Di folder kunci jalankan: npm install && npm run install-service')
  }
})
