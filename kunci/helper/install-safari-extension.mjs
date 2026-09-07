#!/usr/bin/env node
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { toSafariManifest } from './safari-manifest.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SRC = join(ROOT, 'extension')
const DEST = join(homedir(), '.kunci', 'safari-extension')
const pack = process.argv.includes('--pack')

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { ...opts, stdio: opts.stdio || 'inherit' })
    child.on('error', reject)
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))))
  })
}

function runQuiet(cmd, args) {
  return run(cmd, args, { stdio: 'ignore' }).catch(() => {})
}

await run('node', [join(ROOT, 'scripts', 'gen-icons.mjs')], { cwd: ROOT })
if (!existsSync(join(SRC, 'manifest.json'))) {
  throw new Error('Folder extension tidak ada')
}

const chromeManifest = JSON.parse(await readFile(join(SRC, 'manifest.json'), 'utf8'))
await mkdir(DEST, { recursive: true, mode: 0o700 })
await cp(SRC, DEST, { recursive: true })
await writeFile(join(DEST, 'manifest.json'), `${JSON.stringify(toSafariManifest(chromeManifest), null, 2)}\n`)

console.log(`Folder Safari: ${DEST}`)

if (platform() === 'darwin') {
  await runQuiet('open', ['-R', DEST])
}

console.log(`
Safari (Mac)
1. Safari → Settings → Advanced → centang Show features for web developers
2. Tab Developer → Allow unsigned extensions
3. Tab Developer → Add Temporary Extension… → pilih folder ini:
   ${DEST}
4. Settings → Extensions → nyalakan Kunci Autofill
5. Always Allow on Every Website (tanpa ini ikon tidak muncul di situs login)
6. Buka tab Kunci, klik ikon ekstensi, masukkan kata sandi induk

Ekstensi sementara hilang kalau Safari ditutup. Tambahkan lagi, atau:
  npm run install-safari -- --pack
(butuh Xcode / safari-web-extension-packager supaya nempel)

iPhone: isi situs lain di Safari tidak bisa tanpa App Store. Vault Kunci = Safari → Bagikan → Add to Home Screen, plus salin berurutan.
`)

if (pack) {
  if (platform() !== 'darwin') {
    console.error('--pack hanya di Mac.')
    process.exit(1)
  }
  const project = join(homedir(), '.kunci', 'safari-app')
  await mkdir(project, { recursive: true })
  try {
    await run('xcrun', ['safari-web-extension-packager', DEST, '--macos-only', '--project-location', project])
    console.log(`Proyek Xcode: ${project}`)
  } catch {
    try {
      await run('xcrun', [
        'safari-web-extension-converter',
        DEST,
        '--macos-only',
        '--force',
        '--no-open',
        '--project-location',
        project,
        '--app-name',
        'Kunci Autofill',
        '--bundle-identifier',
        'app.kunci.autofill',
      ])
      console.log(`Proyek Xcode: ${project}`)
    } catch (err) {
      console.error('Packager tidak ada atau gagal. Pakai Add Temporary Extension di atas.')
      console.error(err instanceof Error ? err.message : err)
      process.exit(1)
    }
  }
}
