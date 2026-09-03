#!/usr/bin/env node
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, createReadStream, statSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises'

import { accessibilityTrusted, fillCredentials, listGuiApps } from './mac-ax.mjs'

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
const NETLIFY_PRIVATE_SITE_HELP =
  'Situs Netlify Kunci masih Private / Team login. Helper di Mac tidak punya cookie login Netlify, jadi OTP gagal. Di Netlify: Project configuration → General → Visitor access → Project visibility → Public (production). Kunci tetap dikunci kode Gmail + kata sandi induk.'

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

function isNetlifyAccessGate(status, body) {
  if (status !== 401 && status !== 403) return false
  const text = String(body || '').toLowerCase()
  return (
    text.includes('edge-access') ||
    text.includes('login redirect') ||
    text.includes('app.netlify.com') ||
    (text.includes('<!doctype html') && text.includes('netlify'))
  )
}

async function proxyCloud(req, res, url) {
  try {
    const dest = `${CLOUD_ORIGIN}${url.pathname}${url.search}`
    const headers = {
      Origin: CLOUD_ORIGIN,
      Referer: `${CLOUD_ORIGIN}/`,
      Accept: 'application/json',
      'User-Agent': 'Kunci-local/1',
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
    if (isNetlifyAccessGate(forwarded.status, text)) {
      console.error('Cloud Kunci ditolak Site protection Netlify (Private / Team login).')
      json(res, 403, { error: NETLIFY_PRIVATE_SITE_HELP })
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

function serveStatic(req, res) {
  const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname
  if (pathname.startsWith('/api/') || pathname === '/kunci-status') return false
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
      json(res, 200, {
        ok: true,
        platform: platform(),
        version: '1.4.0',
        email: RECOVERY_EMAIL,
        ui: serveUi,
        accessibility: await accessibilityTrusted(),
      })
      return
    }
    if (req.method === 'GET' && url.pathname === '/apps') {
      json(res, 200, {
        ok: true,
        platform: platform(),
        accessibility: await accessibilityTrusted(),
        apps: await listGuiApps(),
      })
      return
    }
    if (req.method === 'GET' && url.pathname === '/api/local-token') {
      json(res, 200, { token, email: RECOVERY_EMAIL })
      return
    }
    if (req.method === 'GET' && url.pathname === '/frontmost') {
      if (!isMac) {
        json(res, 200, { app: null })
        return
      }
      try {
        const name = (
          await run('osascript', ['-e', 'tell application "System Events" to get name of first process whose frontmost is true'])
        ).trim()
        json(res, 200, { app: name || null })
      } catch {
        json(res, 200, { app: null })
      }
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
          ? `${err.message}. Di Mac: System Settings → Privacy & Security → Accessibility, izinkan Node dan osascript.`
          : 'gagal',
    })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Kunci layanan http://127.0.0.1:${PORT}${serveUi ? ' (UI + API)' : ' (API)'}`)
})
