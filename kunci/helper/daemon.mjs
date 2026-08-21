#!/usr/bin/env node
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { existsSync, createReadStream, statSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createConnection as tlsConnect } from 'node:tls'

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
const SMTP_PATH = join(TOKEN_DIR, 'smtp.json')
const serveUi = process.argv.includes('--serve-ui') || process.env.KUNCI_SERVE_UI === '1'

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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Kunci-Token')
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

function hashOtp(code, salt) {
  return createHash('sha256').update(`${salt}:${code}`).digest('hex')
}

async function sendViaMailApp(subject, body) {
  const script = `
tell application "Mail"
  set msg to make new outgoing message with properties {subject:${JSON.stringify(subject)}, content:${JSON.stringify(body + '\n')}, visible:false}
  tell msg
    make new to recipient at end of to recipients with properties {address:${JSON.stringify(RECOVERY_EMAIL)}}
    send
  end tell
end tell
`
  await run('osascript', ['-e', script])
}

function smtpCommand(socket, command) {
  return new Promise((resolve, reject) => {
    const onData = (buf) => {
      const text = buf.toString('utf8')
      socket.off('data', onData)
      if (/^[45]/.test(text.split('\n').pop() || text)) reject(new Error(text.trim()))
      else resolve(text)
    }
    socket.once('data', onData)
    socket.once('error', reject)
    if (command !== null) socket.write(command)
  })
}

async function sendViaSmtp(subject, text) {
  if (!existsSync(SMTP_PATH)) throw new Error('smtp belum dikonfigurasi')
  const cfg = JSON.parse(await readFile(SMTP_PATH, 'utf8'))
  const host = cfg.host || 'smtp.gmail.com'
  const port = Number(cfg.port || 465)
  const user = cfg.user || RECOVERY_EMAIL
  const pass = cfg.pass || cfg.appPassword
  if (!pass) throw new Error('Isi app password Gmail di ~/.kunci/smtp.json')

  await new Promise((resolve, reject) => {
    const socket = tlsConnect(port, host, { servername: host }, async () => {
      try {
        await smtpCommand(socket, null)
        await smtpCommand(socket, `EHLO kunci.local\r\n`)
        await smtpCommand(socket, `AUTH LOGIN\r\n`)
        await smtpCommand(socket, `${Buffer.from(user).toString('base64')}\r\n`)
        await smtpCommand(socket, `${Buffer.from(pass).toString('base64')}\r\n`)
        await smtpCommand(socket, `MAIL FROM:<${user}>\r\n`)
        await smtpCommand(socket, `RCPT TO:<${RECOVERY_EMAIL}>\r\n`)
        await smtpCommand(socket, `DATA\r\n`)
        const payload = [
          `From: Kunci <${user}>`,
          `To: ${RECOVERY_EMAIL}`,
          `Subject: ${subject}`,
          'Content-Type: text/plain; charset=utf-8',
          '',
          text,
          '.',
          '',
        ].join('\r\n')
        await smtpCommand(socket, payload)
        await smtpCommand(socket, `QUIT\r\n`)
        socket.end()
        resolve()
      } catch (err) {
        socket.destroy()
        reject(err)
      }
    })
    socket.setTimeout(20_000, () => {
      socket.destroy()
      reject(new Error('SMTP timeout'))
    })
    socket.on('error', reject)
  })
}

async function sendResetEmail(code) {
  const subject = 'Kode reset Kunci'
  const body = `Kode reset Kunci kamu: ${code}\n\nBerlaku 15 menit. Jika bukan kamu yang meminta, abaikan email ini.\n`
  if (isMac) {
    try {
      await sendViaMailApp(subject, body)
      return 'mail.app'
    } catch {
      /* try smtp */
    }
  }
  await sendViaSmtp(subject, body)
  return 'smtp'
}

function serveStatic(req, res) {
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
      json(res, 200, { ok: true, platform: platform(), version: '1.1.0', email: RECOVERY_EMAIL, ui: serveUi })
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
    if (req.method === 'POST' && url.pathname === '/api/recovery/register') {
      const body = JSON.parse((await readBody(req)) || '{}')
      if (!body.dek || typeof body.dek !== 'string') {
        json(res, 400, { ok: false, error: 'dek wajib' })
        return
      }
      await ensureDir()
      await writeFile(
        RECOVERY_PATH,
        JSON.stringify({ email: RECOVERY_EMAIL, dek: body.dek, updatedAt: Date.now() }),
        { mode: 0o600 },
      )
      json(res, 200, { ok: true, email: RECOVERY_EMAIL })
      return
    }
    if (req.method === 'POST' && url.pathname === '/api/recovery/request') {
      if (!existsSync(RECOVERY_PATH)) {
        json(res, 400, { ok: false, error: 'Reset belum diaktifkan. Buka brankas sekali saat layanan Kunci sedang jalan.' })
        return
      }
      let prev = {}
      if (existsSync(OTP_PATH)) prev = JSON.parse(await readFile(OTP_PATH, 'utf8'))
      if (prev.sentAt && Date.now() - prev.sentAt < 30_000) {
        json(res, 429, { ok: false, error: 'Tunggu 30 detik sebelum meminta kode baru' })
        return
      }
      const code = String(randomInt(100000, 1000000)).padStart(6, '0')
      const salt = randomBytes(16).toString('hex')
      await writeFile(
        OTP_PATH,
        JSON.stringify({
          hash: hashOtp(code, salt),
          salt,
          expiresAt: Date.now() + 15 * 60 * 1000,
          attempts: 0,
          sentAt: Date.now(),
        }),
        { mode: 0o600 },
      )
      try {
        const via = await sendResetEmail(code)
        json(res, 200, { ok: true, email: RECOVERY_EMAIL, via })
      } catch (err) {
        json(res, 500, {
          ok: false,
          error:
            'Gagal mengirim email. Setel Gmail di Mail.app, atau buat ~/.kunci/smtp.json berisi { "user": "tiftazani.khara@gmail.com", "pass": "APP_PASSWORD" }.',
          detail: err instanceof Error ? err.message : String(err),
        })
      }
      return
    }
    if (req.method === 'POST' && url.pathname === '/api/recovery/confirm') {
      const body = JSON.parse((await readBody(req)) || '{}')
      if (!existsSync(OTP_PATH) || !existsSync(RECOVERY_PATH)) {
        json(res, 400, { ok: false, error: 'Tidak ada permintaan reset yang aktif' })
        return
      }
      const otp = JSON.parse(await readFile(OTP_PATH, 'utf8'))
      const rec = JSON.parse(await readFile(RECOVERY_PATH, 'utf8'))
      if (Date.now() > otp.expiresAt) {
        json(res, 400, { ok: false, error: 'Kode kedaluwarsa. Minta kode baru.' })
        return
      }
      if (otp.attempts >= 5) {
        json(res, 429, { ok: false, error: 'Terlalu banyak percobaan. Minta kode baru.' })
        return
      }
      const incoming = hashOtp(String(body.code || ''), otp.salt)
      const a = Buffer.from(incoming)
      const b = Buffer.from(otp.hash)
      const match = a.length === b.length && timingSafeEqual(a, b)
      otp.attempts += 1
      await writeFile(OTP_PATH, JSON.stringify(otp), { mode: 0o600 })
      if (!match) {
        json(res, 401, { ok: false, error: 'Kode salah' })
        return
      }
      await writeFile(OTP_PATH, JSON.stringify({ ...otp, expiresAt: 0 }), { mode: 0o600 })
      json(res, 200, { ok: true, dek: rec.dek })
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
  console.log(`Reset password: ${RECOVERY_EMAIL}`)
})
