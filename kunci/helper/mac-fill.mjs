#!/usr/bin/env node
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { homedir, platform } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { randomBytes } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.KUNCI_HELPER_PORT || 17834)
const TOKEN_DIR = join(homedir(), '.kunci')
const TOKEN_PATH = join(TOKEN_DIR, 'helper-token')
const isMac = platform() === 'darwin'

function cors(req, res) {
  const origin = req.headers.origin || '*'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Kunci-Token')
  res.setHeader('Access-Control-Allow-Private-Network', 'true')
  res.setHeader('Vary', 'Origin')
}

async function loadToken() {
  if (!existsSync(TOKEN_DIR)) await mkdir(TOKEN_DIR, { recursive: true, mode: 0o700 })
  if (existsSync(TOKEN_PATH)) {
    return (await readFile(TOKEN_PATH, 'utf8')).trim()
  }
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

async function pbcopy(text) {
  await run('pbcopy', [], text)
}

async function pbpaste() {
  return run('pbpaste', [])
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function keystrokePaste() {
  await run('osascript', ['-e', 'tell application "System Events" to keystroke "v" using command down'])
}

async function keystrokeTab() {
  await run('osascript', ['-e', 'tell application "System Events" to keystroke tab'])
}

async function fillMac(username, password, mode) {
  if (!isMac) throw new Error('Helper isi aplikasi hanya berjalan di macOS')
  const previous = await pbpaste().catch(() => '')
  try {
    if (mode === 'login' && username) {
      await pbcopy(username)
      await sleep(80)
      await keystrokePaste()
      await sleep(140)
      await keystrokeTab()
      await sleep(80)
    }
    if (password) {
      await pbcopy(password)
      await sleep(80)
      await keystrokePaste()
    }
  } finally {
    await sleep(400)
    await pbcopy(previous).catch(() => {})
  }
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
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, platform: platform(), version: '1.0.0' }))
      return
    }
    if (req.method === 'POST' && url.pathname === '/fill') {
      const provided = req.headers['x-kunci-token'] || ''
      if (provided !== token) {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: 'Token helper salah' }))
        return
      }
      const body = JSON.parse((await readBody(req)) || '{}')
      await fillMac(body.username || '', body.password || '', body.mode || 'login')
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true }))
      return
    }
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: 'not found' }))
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        ok: false,
        error:
          err instanceof Error
            ? `${err.message}. Di Mac: izinkan Terminal di Privacy & Security → Accessibility.`
            : 'gagal',
      }),
    )
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Kunci helper http://127.0.0.1:${PORT}`)
  console.log(`Token (tempel di Kunci → Autofill):\n${token}`)
  console.log(`Disimpan di ${TOKEN_PATH}`)
})

if (process.argv.includes('--with-ui')) {
  spawn('npm', ['run', 'dev'], {
    cwd: join(__dirname, '..'),
    stdio: 'inherit',
    shell: true,
  })
}
