import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir, unlink, writeFile } from 'node:fs/promises'

import { helperAppBundlePath, helperBinPath, revealHelperApp } from './build-helper-app.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TOKEN_DIR = join(homedir(), '.kunci')
const AX_SCRIPT = join(__dirname, 'ax-fill.jxa')
const isMac = platform() === 'darwin'

export { helperBinPath, helperAppBundlePath, revealHelperApp }

const SKIP_APPS = new Set(['finder', 'kunci helper', 'osascript', 'loginwindow'])
const REQUEST_PATH = join(TOKEN_DIR, 'helper-request.json')

function uniqueApps(names) {
  const seen = new Set()
  const apps = []
  for (const name of names) {
    const key = String(name || '').trim()
    if (!key || SKIP_APPS.has(key.toLowerCase()) || seen.has(key.toLowerCase())) continue
    seen.add(key.toLowerCase())
    apps.push(key)
  }
  return apps.sort((a, b) => a.localeCompare(b))
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

async function helperCmd(args, { throwOnError = false } = {}) {
  const bin = helperBinPath()
  if (!bin) return null
  await mkdir(TOKEN_DIR, { recursive: true, mode: 0o700 })
  await writeFile(REQUEST_PATH, JSON.stringify({ cmd: args[0], args: args.slice(1).map(String) }), { mode: 0o600 })
  const attempts = [() => run(bin, args.map(String)), () => run(bin, [])]
  let lastErr
  for (const attempt of attempts) {
    try {
      return await attempt()
    } catch (err) {
      lastErr = err
    }
  }
  if (throwOnError) throw lastErr instanceof Error ? lastErr : new Error('Kunci Helper gagal dijalankan')
  return null
}

export async function accessibilityTrusted() {
  if (!isMac) return false
  try {
    const fromApp = await helperCmd(['status'])
    if (fromApp != null && fromApp.trim()) return fromApp.includes('trusted=true')
    const out = await run('osascript', [
      '-l',
      'JavaScript',
      '-e',
      'ObjC.import("ApplicationServices"); $.AXIsProcessTrusted()',
    ])
    return out.trim() === 'true'
  } catch {
    return false
  }
}

export async function promptAccessibility() {
  if (!isMac) return { ok: false, error: 'bukan macOS' }
  try {
    const fromApp = await helperCmd(['prompt'])
    if (fromApp != null && fromApp.trim()) {
      return { ok: true, trusted: fromApp.includes('trusted=true'), helper: 'Kunci Helper' }
    }
    await run('osascript', [
      '-l',
      'JavaScript',
      '-e',
      'ObjC.import("ApplicationServices"); $.AXIsProcessTrustedWithOptions($({"AXTrustedCheckOptionPrompt": true}))',
    ])
    return { ok: true, trusted: await accessibilityTrusted(), helper: 'osascript' }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'gagal meminta izin' }
  }
}

export async function listGuiApps() {
  if (!isMac) return []
  try {
    const fromApp = await helperCmd(['apps'])
    if (fromApp != null && fromApp.trim()) {
      const names = JSON.parse(fromApp.trim() || '[]')
      return uniqueApps(Array.isArray(names) ? names : [])
    }
    const out = await run('osascript', [
      '-l',
      'JavaScript',
      '-e',
      `const se = Application("System Events");
       const procs = se.applicationProcesses.whose({ backgroundOnly: false });
       const names = [];
       for (let i = 0; i < procs.length; i++) names.push(String(procs[i].name()));
       JSON.stringify(names);`,
    ])
    const names = JSON.parse(out.trim() || '[]')
    return uniqueApps(Array.isArray(names) ? names : [])
  } catch {
    return []
  }
}

export async function frontmostName() {
  if (!isMac) return null
  try {
    const fromApp = await helperCmd(['frontmost'])
    if (fromApp != null) return fromApp.trim() || null
    const name = (
      await run('osascript', ['-e', 'tell application "System Events" to get name of first process whose frontmost is true'])
    ).trim()
    return name || null
  } catch {
    return null
  }
}

async function pbcopy(text) {
  await run('pbcopy', [], text)
}

async function pbpaste() {
  return run('pbpaste', [])
}

async function activateApp(appName) {
  if (!appName) return
  try {
    await run('osascript', ['-e', `tell application "System Events" to set frontmost of process ${JSON.stringify(appName)} to true`])
    return
  } catch {
    /* try by application name */
  }
  try {
    await run('osascript', ['-e', `tell application ${JSON.stringify(appName)} to activate`])
  } catch {
    /* paste still attempted */
  }
}

async function keystrokePaste() {
  await run('osascript', ['-e', 'tell application "System Events" to keystroke "v" using command down'])
}

async function keystrokeTab() {
  await run('osascript', ['-e', 'tell application "System Events" to keystroke tab'])
}

async function axFill(job) {
  if (!existsSync(AX_SCRIPT)) return { ok: false, needKeystroke: true }
  await mkdir(TOKEN_DIR, { recursive: true, mode: 0o700 })
  const jobPath = join(TOKEN_DIR, `fill-${randomBytes(8).toString('hex')}.json`)
  await writeFile(jobPath, JSON.stringify(job), { mode: 0o600 })
  try {
    const out = await run('osascript', [AX_SCRIPT, jobPath])
    const line = out.trim().split('\n').filter(Boolean).pop() || '{}'
    return JSON.parse(line)
  } catch {
    return { ok: false, needKeystroke: true }
  } finally {
    await unlink(jobPath).catch(() => {})
  }
}

async function fillWithHelperApp(job) {
  if (!helperBinPath()) return null
  await mkdir(TOKEN_DIR, { recursive: true, mode: 0o700 })
  const jobPath = join(TOKEN_DIR, `fill-${randomBytes(8).toString('hex')}.json`)
  await writeFile(jobPath, JSON.stringify(job), { mode: 0o600 })
  try {
    const out = await helperCmd(['fill', jobPath], { throwOnError: true })
    return { ok: /ok=true/.test(out || ''), method: 'kunci-helper', app: job.appName || null }
  } finally {
    await unlink(jobPath).catch(() => {})
  }
}

export async function fillCredentials({ username = '', password = '', mode = 'login', appName = '', waitMs = 0 }) {
  if (!isMac) throw new Error('Isi aplikasi hanya berjalan di Mac. Buka http://127.0.0.1:8780 di Mac yang sama.')
  const job = { username, password, mode, appName, waitMs: Math.min(waitMs, 8000) }
  if (helperBinPath()) {
    try {
      const viaApp = await fillWithHelperApp(job)
      if (viaApp?.ok) return viaApp
    } catch (err) {
      throw new Error(
        `${err instanceof Error ? err.message : 'Gagal mengisi'}. Izinkan Kunci Helper di System Settings → Privacy & Security → Accessibility (bukan osascript).`,
      )
    }
    throw new Error('Izinkan Kunci Helper di System Settings → Privacy & Security → Accessibility (bukan osascript).')
  }

  if (waitMs > 0) await sleep(Math.min(waitMs, 8000))
  if (appName) await activateApp(appName)

  const ax = await axFill({ username, password, mode, appName, waitMs: 0 })
  if (ax.ok && !ax.needKeystroke) return { ok: true, method: 'ax', app: ax.app || appName }

  const previous = await pbpaste().catch(() => '')
  try {
    if (appName) await activateApp(appName)
    await sleep(280)
    if (mode === 'login' && username) {
      await pbcopy(username)
      await sleep(90)
      await keystrokePaste()
      await sleep(160)
      await keystrokeTab()
      await sleep(90)
    }
    if (password) {
      await pbcopy(password)
      await sleep(90)
      await keystrokePaste()
    }
  } finally {
    await sleep(450)
    await pbcopy(previous).catch(() => {})
  }
  return { ok: true, method: 'keystroke', app: ax.app || appName || null }
}
