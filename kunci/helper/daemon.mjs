#!/usr/bin/env node
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, createReadStream, statSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DIST = join(ROOT, 'dist')
const isMac = platform() === 'darwin'
const RECOVERY_EMAIL = 'tiftazani.khara@gmail.com'
const PORT = Number(process.env.KUNCI_PORT || 8780)
const TOKEN_DIR = join(homedir(), '.kunci')
const TOKEN_PATH = join(TOKEN_DIR, 'helper-token')
const RECOVERY_PATH = join(TOKEN_DIR, 'recovery.json')
const OTP_PATH = join(TOKEN_DIR, 'otp.json')
const CLOUD_ORIGIN = 'https://kunci-tifta.netlify.app'
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

function run(cmd, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args)
    const out = []
    const err = []
    child.stdout.on('data', (d) => out.push(d))
    child.stderr.on('data', (d) => err.push(d))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(out).toString('utf8'))
      else reject(new Error(Buffer.concat(err).toString('utf8') || `${cmd} exited ${code}`))
    })
    if (input !== undefined) {
      child.stdin.write(input)
      child.stdin.end()
    }
  })
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function pbcopy(text) {
  await run('pbcopy', [], text)
}

async function pbpaste() {
  return run('pbpaste', [])
}

async function fillMac(username, password, mode) {
  if (!isMac) throw new Error('Helper isi aplikasi hanya berjalan di macOS')
  const previous = await pbpaste().catch(() => '')
  try {
    if (mode === 'login' && username) {
      await pbcopy(username)
      await sleep(80)
      await run('osascript', ['-e', 'tell application "System Events" to keystroke "v" using command down'])
      await sleep(140)
      await run('osascript', ['-e', 'tell application "System Events" to keystroke tab'])
      await sleep(80)
    }
    if (password) {
      await pbcopy(password)
      await sleep(80)
      await run('osascript', ['-e', 'tell application "System Events" to keystroke "v" using command down'])
    }
  } finally {
    await sleep(400)
    await pbcopy(previous).catch(() => {})
  }
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
  if (!pathname.startsWith('/api/')) return false
  if (pathname === '/api/local-token') return false
  if (pathname.startsWith('/api/recovery')) return false
  return true
}

async function proxyCloud(req, res, url) {
  const dest = `${CLOUD_ORIGIN}${url.pathname}${url.search}`
  const headers = {
    Origin: `http://127.0.0.1:${PORT}`,
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
  const out = {
    'Content-Type': forwarded.headers.get('content-type') || 'application/json',
    'Cache-Control': 'no-store',
  }
  const cookies = typeof forwarded.headers.getSetCookie === 'function' ? forwarded.headers.getSetCookie() : []
  res.writeHead(forwarded.status, cookies.length ? { ...out, 'Set-Cookie': cookies } : out)
  res.end(text)
}

function serveStatic(req, res) {
  if (new URL(req.url || '/', 'http://127.0.0.1').pathname.startsWith('/api/')) return false
  if (!serveUi || !existsSync(DIST)) return false
  let path = new URL(req.url || '/', 'http://127.0.0.1').pathname
  if (path === '/') path = '/index.html'
  const file = join(DIST, path)
  if (!file.startsWith(DIST)) return false
  if (!existsSync(file) || statSync(file).isDirectory()) {
    const fallback = join(DIST, 'index.html')
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
      json(res, 200, { ok: true, platform: platform(), version: '1.2.0', email: RECOVERY_EMAIL, ui: serveUi })
      return
    }
    if (req.method === 'GET' && url.pathname === '/api/local-token') {
      json(res, 200, { token, email: RECOVERY_EMAIL })
      return
    }
    if (req.method === 'POST' && url.pathname === '/fill') {
      const provided = String(req.headers['x-kunci-token'] || '')
      if (provided !== token) {
        json(res, 401, { ok: false, error: 'Token helper salah' })
        return
      }
      const body = JSON.parse((await readBody(req)) || '{}')
      await fillMac(body.username || '', body.password || '', body.mode || 'login')
      json(res, 200, { ok: true })
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
    if (req.method === 'GET' && serveStatic(req, res)) return
    json(res, 404, { ok: false, error: 'not found' })
  } catch (err) {
    json(res, 500, {
      ok: false,
      error:
        err instanceof Error
          ? `${err.message}. Di Mac: izinkan Node di Privacy & Security → Accessibility jika ini permintaan isi app.`
          : 'gagal',
    })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Kunci layanan http://127.0.0.1:${PORT}${serveUi ? ' (UI + API)' : ' (API)'}`)
})
