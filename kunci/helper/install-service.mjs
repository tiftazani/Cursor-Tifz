#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { homedir, platform, userInfo } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { buildKunciHelperApp, quitHelperProcesses } from './build-helper-app.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const LABEL = 'com.kunci.daemon'
const uid = userInfo().uid
const plistDir = join(homedir(), 'Library', 'LaunchAgents')
const plistPath = join(plistDir, `${LABEL}.plist`)
const logsDir = join(homedir(), 'Library', 'Logs')
const uninstall = process.argv.includes('--uninstall')

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: ROOT, stdio: 'inherit' })
    child.on('error', reject)
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))))
  })
}

function runQuiet(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: 'ignore' })
    child.on('close', () => resolve())
    child.on('error', () => resolve())
  })
}

function runCode(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: 'ignore' })
    child.on('error', () => resolve(1))
    child.on('close', (code) => resolve(code ?? 1))
  })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function isLoaded() {
  return (await runCode('launchctl', ['print', `gui/${uid}/${LABEL}`])) === 0
}

async function enableService() {
  await runQuiet('launchctl', ['bootout', `gui/${uid}/${LABEL}`])
  await runQuiet('launchctl', ['unload', '-w', plistPath])
  await sleep(1000)

  let loaded = (await runCode('launchctl', ['load', '-w', plistPath])) === 0
  if (!loaded) {
    loaded = (await runCode('launchctl', ['bootstrap', `gui/${uid}`, plistPath])) === 0
  }
  await sleep(400)
  await runQuiet('launchctl', ['kickstart', '-k', `gui/${uid}/${LABEL}`])
  return loaded || (await isLoaded())
}

async function waitForHealth() {
  for (let i = 0; i < 24; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:8780/health`)
      if (res.ok) return true
    } catch {
      /* still starting */
    }
    await sleep(250)
  }
  return false
}

if (platform() !== 'darwin') {
  console.error('install-service hanya untuk macOS.')
  process.exit(1)
}

if (uninstall) {
  await quitHelperProcesses()
  await runQuiet('launchctl', ['bootout', `gui/${uid}/${LABEL}`])
  console.log('Layanan Kunci dihentikan. UI 24 jam mati; hapus plist jika perlu:')
  console.log(plistPath)
  process.exit(0)
}

console.log('Menghentikan Kunci Helper yang numpuk di Dock…')
await quitHelperProcesses()
await runQuiet('launchctl', ['bootout', `gui/${uid}/${LABEL}`])
await runQuiet('launchctl', ['unload', '-w', plistPath])

console.log('Build produksi…')
await run('npm', ['run', 'build'])
if (!existsSync(join(ROOT, 'dist', 'index.html'))) {
  throw new Error('Build gagal: dist/index.html tidak ada')
}

await mkdir(plistDir, { recursive: true })
await mkdir(logsDir, { recursive: true })

const nodePath = process.execPath
const daemonPath = join(ROOT, 'helper', 'daemon.mjs')
const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>WorkingDirectory</key>
  <string>${ROOT}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodePath}</string>
    <string>${daemonPath}</string>
    <string>--serve-ui</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>KUNCI_SERVE_UI</key>
    <string>1</string>
    <key>KUNCI_PORT</key>
    <string>8780</string>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>StandardOutPath</key>
  <string>${join(logsDir, 'kunci.log')}</string>
  <key>StandardErrorPath</key>
  <string>${join(logsDir, 'kunci.err.log')}</string>
</dict>
</plist>
`
await writeFile(plistPath, plist, { mode: 0o644 })

console.log('\nMemasang Kunci Helper.app ke /Applications…')
const helperBuild = await buildKunciHelperApp()
if (helperBuild.ok) {
  console.log(`App: ${helperBuild.path}`)
  if (helperBuild.installed?.length) console.log(`Salinan: ${helperBuild.installed.join(', ')}`)
} else {
  console.log(`Kunci Helper.app belum terpasang: ${helperBuild.error}`)
}

await enableService()
const healthy = await waitForHealth()

if (helperBuild.ok) {
  console.log('Sidebar Finder "Applications" = /Applications, bukan folder Applications di Home.')
  await runQuiet('open', [
    'x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Accessibility',
  ])
  await runQuiet('open', ['x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'])
  console.log('Di Accessibility centang Kunci Helper. Jangan klik app-nya di Dock — itu yang nge-spawn dialog.')
}

if (healthy) {
  console.log('\nKunci jalan terus di background. Terminal boleh ditutup.')
  console.log('Buka: http://127.0.0.1:8780')
  console.log('Ikut nyala lagi setiap login Mac.')
} else {
  console.log('\nPlist sudah dipasang, tapi http://127.0.0.1:8780 belum merespons.')
  console.log('Cek log: ~/Library/Logs/kunci.err.log')
  process.exit(1)
}
console.log('Stop: npm run uninstall-service')
