import { spawn } from 'node:child_process'
import { chmod, mkdir, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SWIFT = join(__dirname, 'KunciHelper.swift')
export const HELPER_APP_NAME = 'Kunci Helper.app'
export const HELPER_ID = 'app.kunci.helper'

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { ...opts })
    const out = []
    const err = []
    child.stdout?.on('data', (d) => out.push(d))
    child.stderr?.on('data', (d) => err.push(d))
    child.on('error', reject)
    child.on('close', (code) => {
      const stdout = Buffer.concat(out).toString('utf8')
      const stderr = Buffer.concat(err).toString('utf8')
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error(stderr.trim() || stdout.trim() || `${cmd} exited ${code}`))
    })
  })
}

function plist(execName) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>id</string>
  <key>CFBundleDisplayName</key>
  <string>Kunci Helper</string>
  <key>CFBundleExecutable</key>
  <string>${execName}</string>
  <key>CFBundleIdentifier</key>
  <string>${HELPER_ID}</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>Kunci Helper</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.4.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>LSUIElement</key>
  <true/>
  <key>NSAppleEventsUsageDescription</key>
  <string>Kunci mengisi username dan password ke aplikasi yang kamu pilih.</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
`
}

export function helperAppPath() {
  return join(homedir(), 'Applications', HELPER_APP_NAME)
}

export function helperBinPath(appPath = helperAppPath()) {
  return join(appPath, 'Contents', 'MacOS', 'Kunci Helper')
}

export async function buildKunciHelperApp() {
  const dest = helperAppPath()
  const macOS = join(dest, 'Contents', 'MacOS')
  const bin = helperBinPath(dest)
  await mkdir(join(homedir(), 'Applications'), { recursive: true })
  if (existsSync(dest)) await rm(dest, { recursive: true, force: true })
  await mkdir(macOS, { recursive: true })
  await writeFile(join(dest, 'Contents', 'Info.plist'), plist('Kunci Helper'))
  try {
    await run('swiftc', ['-O', '-parse-as-library', '-framework', 'AppKit', '-framework', 'ApplicationServices', '-o', bin, SWIFT])
  } catch (err) {
    await rm(dest, { recursive: true, force: true }).catch(() => {})
    return {
      ok: false,
      path: dest,
      error:
        err instanceof Error
          ? `${err.message}. Pasang Command Line Tools: xcode-select --install`
          : 'swiftc gagal',
    }
  }
  await chmod(bin, 0o755)
  try {
    await run('codesign', ['--force', '--sign', '-', '--identifier', HELPER_ID, dest])
  } catch {
    /* ad-hoc sign optional */
  }
  return { ok: true, path: dest }
}
