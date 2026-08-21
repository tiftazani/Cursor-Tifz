#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { homedir, platform, userInfo } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'

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
  if (await isLoaded()) {
    await runQuiet('launchctl', ['bootout', `gui/${uid}/${LABEL}`])
    await sleep(800)
  }
  let ok = false
  for (let i = 0; i < 3 && !ok; i++) {
    ok = (await runCode('launchctl', ['bootstrap', `gui/${uid}`, plistPath])) === 0
    if (!ok) await sleep(500)
  }
  if (!ok) {
    await runQuiet('launchctl', ['load', '-w', plistPath])
    await sleep(400)
  }
  if (!(await isLoaded())) {
    throw new Error(
      'launchctl tidak memasang layanan. Di Terminal, tanpa sudo:\n' +
        `  launchctl bootstrap gui/${uid} ${plistPath}\n` +
        'Atau jalankan sementara: npm run start  lalu buka http://127.0.0.1:8780',
    )
  }
  await runQuiet('launchctl', ['kickstart', '-k', `gui/${uid}/${LABEL}`])
}

if (platform() !== 'darwin') {
  console.error('install-service hanya untuk macOS.')
  process.exit(1)
}

if (uninstall) {
  await runQuiet('launchctl', ['bootout', `gui/${uid}/${LABEL}`])
  console.log('Layanan Kunci dihentikan. UI 24 jam mati; hapus plist jika perlu:')
  console.log(plistPath)
  process.exit(0)
}

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
await enableService()

console.log('\nKunci sekarang jalan di background (tanpa terminal).')
console.log('Buka: http://127.0.0.1:8780')
console.log('Reset kata sandi: pakai recovery key di layar Kunci (bukan email DEK).')
console.log('Log: ~/Library/Logs/kunci.log')
console.log('\nKalau http://localhost:5173 masih dari npm run dev, itu boleh ditutup.')
console.log('Stop layanan: npm run uninstall-service')
