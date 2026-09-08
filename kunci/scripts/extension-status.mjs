#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const NEED = '1.2.6'
const BRANCH = 'cursor/kunci-password-manager-4eaf'
const manifestPath = join(ROOT, 'extension', 'manifest.json')

function git(args) {
  try {
    return execSync(`git ${args}`, { cwd: join(ROOT, '..'), encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const version = manifest.version
const branch = git('rev-parse --abbrev-ref HEAD')
const head = git('rev-parse --short HEAD')
const versionFile = join(ROOT, 'extension', 'VERSION')
const fileVer = existsSync(versionFile) ? (await readFile(versionFile, 'utf8')).trim() : '(tidak ada)'

console.log(`Folder:     ${join(ROOT, 'extension')}`)
console.log(`Git branch: ${branch || '(bukan git)'}`)
console.log(`Git commit: ${head || '-'}`)
console.log(`manifest:   ${version}`)
console.log(`VERSION:    ${fileVer}`)
console.log(`Harus:      ${NEED} di branch ${BRANCH}`)

if (version !== NEED || branch !== BRANCH) {
  console.log(`
Chrome yang masih 1.2.4 artinya file di folder ini belum di-update. Path-nya boleh benar.

Di Terminal:

cd ~/Cursor-Tifz
git fetch origin
git checkout ${BRANCH}
git pull origin ${BRANCH}
grep version kunci/extension/manifest.json

Baris version harus "${NEED}". Baru chrome://extensions → Remove → Load unpacked ke:

${join(ROOT, 'extension')}
`)
  process.exit(1)
}

console.log('\nFile sudah 1.2.6. Di Chrome: Remove, Load unpacked ke folder di atas, Clear all di Errors.')
