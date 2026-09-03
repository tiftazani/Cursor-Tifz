import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir, unlink, writeFile } from 'node:fs/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TOKEN_DIR = join(homedir(), '.kunci')
const AX_SCRIPT = join(__dirname, 'ax-fill.jxa')
const isMac = platform() === 'darwin'

const SKIP_APPS = new Set([
  'finder',
  'dock',
  'systemuiserver',
  'controlcenter',
  'notificationcenter',
  'spotlight',
  'windowserver',
  'loginwindow',
  'wallpaper',
  'universalcontrol',
])

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

export async function accessibilityTrusted() {
  if (!isMac) return false
  try {
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

export async function listGuiApps() {
  if (!isMac) return []
  try {
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
    const seen = new Set()
    const apps = []
    for (const name of names) {
      const key = String(name || '').trim()
      if (!key || SKIP_APPS.has(key.toLowerCase()) || seen.has(key.toLowerCase())) continue
      seen.add(key.toLowerCase())
      apps.push(key)
    }
    return apps.sort((a, b) => a.localeCompare(b))
  } catch {
    return []
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

export async function fillCredentials({ username = '', password = '', mode = 'login', appName = '', waitMs = 0 }) {
  if (!isMac) throw new Error('Isi aplikasi hanya berjalan di Mac. Buka http://127.0.0.1:8780 di Mac yang sama.')
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
