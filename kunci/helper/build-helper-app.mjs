import { spawn } from 'node:child_process'
import { chmod, cp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const JXA = join(__dirname, 'KunciHelper.jxa')
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

export function candidateAppPaths() {
  return [join('/Applications', HELPER_APP_NAME), join(homedir(), 'Applications', HELPER_APP_NAME)]
}

function binNames(appPath) {
  return [join(appPath, 'Contents', 'MacOS', 'Kunci Helper'), join(appPath, 'Contents', 'MacOS', 'applet')]
}

export function helperAppBundlePath() {
  for (const appPath of candidateAppPaths()) {
    if (binNames(appPath).some((bin) => existsSync(bin))) return appPath
  }
  const local = join(__dirname, HELPER_APP_NAME)
  if (binNames(local).some((bin) => existsSync(bin))) return local
  return null
}

export function helperBinPath() {
  const appPath = helperAppBundlePath()
  if (!appPath) return null
  return binNames(appPath).find((bin) => existsSync(bin)) || null
}

async function patchPlist(appPath) {
  const plist = join(appPath, 'Contents', 'Info.plist')
  if (!existsSync(plist)) return
  try {
    await run('/usr/libexec/PlistBuddy', ['-c', `Set :CFBundleIdentifier ${HELPER_ID}`, plist])
  } catch {
    try {
      await run('/usr/libexec/PlistBuddy', ['-c', `Add :CFBundleIdentifier string ${HELPER_ID}`, plist])
    } catch {
      /* ignore */
    }
  }
  for (const [key, value] of [
    ['CFBundleName', 'Kunci Helper'],
    ['CFBundleDisplayName', 'Kunci Helper'],
  ]) {
    try {
      await run('/usr/libexec/PlistBuddy', ['-c', `Set :${key} ${value}`, plist])
    } catch {
      try {
        await run('/usr/libexec/PlistBuddy', ['-c', `Add :${key} string ${value}`, plist])
      } catch {
        /* ignore */
      }
    }
  }
  try {
    await run('/usr/libexec/PlistBuddy', ['-c', 'Set :LSUIElement true', plist])
  } catch {
    try {
      await run('/usr/libexec/PlistBuddy', ['-c', 'Add :LSUIElement bool true', plist])
    } catch {
      /* ignore */
    }
  }
  try {
    await run('/usr/libexec/PlistBuddy', [
      '-c',
      'Set :NSAppleEventsUsageDescription Kunci mengisi username dan password ke aplikasi yang kamu pilih.',
      plist,
    ])
  } catch {
    try {
      await run('/usr/libexec/PlistBuddy', [
        '-c',
        'Add :NSAppleEventsUsageDescription string Kunci mengisi username dan password ke aplikasi yang kamu pilih.',
        plist,
      ])
    } catch {
      /* ignore */
    }
  }
}

async function compileApplet(staging) {
  if (existsSync(staging)) await rm(staging, { recursive: true, force: true })
  await run('osacompile', ['-l', 'JavaScript', '-o', staging, JXA])
  await patchPlist(staging)
  try {
    await run('codesign', ['--force', '--sign', '-', '--identifier', HELPER_ID, staging])
  } catch {
    /* optional */
  }
}

async function compileSwift(appPath) {
  const macOS = join(appPath, 'Contents', 'MacOS')
  const bin = join(macOS, 'Kunci Helper')
  await mkdir(macOS, { recursive: true })
  await writeFile(
    join(appPath, 'Contents', 'Info.plist'),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key><string>Kunci Helper</string>
  <key>CFBundleExecutable</key><string>Kunci Helper</string>
  <key>CFBundleIdentifier</key><string>${HELPER_ID}</string>
  <key>CFBundleName</key><string>Kunci Helper</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.4.1</string>
  <key>LSUIElement</key><true/>
  <key>NSAppleEventsUsageDescription</key>
  <string>Kunci mengisi username dan password ke aplikasi yang kamu pilih.</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
`,
  )
  await run('swiftc', [
    '-O',
    '-parse-as-library',
    '-framework',
    'AppKit',
    '-framework',
    'ApplicationServices',
    '-o',
    bin,
    SWIFT,
  ])
  await chmod(bin, 0o755)
  try {
    await run('codesign', ['--force', '--sign', '-', '--identifier', HELPER_ID, appPath])
  } catch {
    /* optional */
  }
}

async function installCopy(staging, dest) {
  if (existsSync(dest)) await rm(dest, { recursive: true, force: true })
  await mkdir(dirname(dest), { recursive: true })
  await cp(staging, dest, { recursive: true })
}

export async function buildKunciHelperApp() {
  const staging = join(homedir(), '.kunci', 'build-Kunci-Helper.app')
  const homeDest = join(homedir(), 'Applications', HELPER_APP_NAME)
  const systemDest = join('/Applications', HELPER_APP_NAME)
  await mkdir(join(homedir(), '.kunci'), { recursive: true, mode: 0o700 })
  await mkdir(join(homedir(), 'Applications'), { recursive: true })

  let method = 'osacompile'
  try {
    await compileApplet(staging)
  } catch (osacompileErr) {
    method = 'swiftc'
    if (existsSync(staging)) await rm(staging, { recursive: true, force: true })
    await mkdir(join(staging, 'Contents', 'MacOS'), { recursive: true })
    try {
      await compileSwift(staging)
    } catch (swiftErr) {
      return {
        ok: false,
        path: systemDest,
        error: `Gagal membuat app (${osacompileErr instanceof Error ? osacompileErr.message : osacompileErr}; ${swiftErr instanceof Error ? swiftErr.message : swiftErr})`,
      }
    }
  }

  const installed = []
  try {
    await installCopy(staging, homeDest)
    installed.push(homeDest)
  } catch (err) {
    return { ok: false, path: homeDest, error: err instanceof Error ? err.message : 'Gagal salin ke ~/Applications' }
  }

  try {
    await installCopy(staging, systemDest)
    installed.push(systemDest)
  } catch {
    try {
      if (existsSync(systemDest)) await rm(systemDest, { recursive: true, force: true })
      await symlink(homeDest, systemDest)
      installed.push(`${systemDest} → ${homeDest}`)
    } catch {
      /* Finder sidebar /Applications may stay empty; homeDest still works */
    }
  }

  try {
    await run('open', ['-R', existsSync(systemDest) ? systemDest : homeDest])
  } catch {
    await run('open', [join(homedir(), 'Applications')]).catch(() => {})
  }

  return {
    ok: true,
    path: existsSync(systemDest) ? systemDest : homeDest,
    method,
    installed,
  }
}

export async function quitHelperProcesses() {
  const patterns = [
    'Kunci Helper.app/Contents/MacOS',
    '/Applications/Kunci Helper.app',
    `${homedir()}/Applications/Kunci Helper.app`,
  ]
  for (const pattern of patterns) {
    try {
      await run('pkill', ['-9', '-f', pattern])
    } catch {
      /* none running */
    }
  }
  try {
    await run('killall', ['-9', 'Kunci Helper'])
  } catch {
    /* none running */
  }
}

export async function revealHelperApp() {
  const appPath = helperAppBundlePath()
  if (!appPath) {
    return { ok: false, error: 'Kunci Helper.app belum ada. Di folder kunci jalankan npm run install-service.' }
  }
  try {
    await run('open', ['-R', appPath])
    return { ok: true, path: appPath }
  } catch (err) {
    return { ok: false, path: appPath, error: err instanceof Error ? err.message : 'Gagal membuka Finder' }
  }
}
