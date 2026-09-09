#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { EXTENSION_DIR, KUNCI_BRANCH, KUNCI_ROOT, REPO_ROOT, refreshCommands } from '../helper/repo-paths.mjs'

const NEED = '1.2.9'
const manifestPath = join(EXTENSION_DIR, 'manifest.json')

function git(args) {
  try {
    return execSync(`git ${args}`, { cwd: REPO_ROOT, encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const version = manifest.version
const branch = git('rev-parse --abbrev-ref HEAD')
const head = git('rev-parse --short HEAD')
const versionFile = join(EXTENSION_DIR, 'VERSION')
const fileVer = existsSync(versionFile) ? (await readFile(versionFile, 'utf8')).trim() : '(tidak ada)'
const cmds = refreshCommands()

console.log(`Repo:       ${REPO_ROOT}`)
console.log(`Kunci:      ${KUNCI_ROOT}`)
console.log(`Folder:     ${EXTENSION_DIR}`)
console.log(`Git branch: ${branch || '(bukan git)'}`)
console.log(`Git commit: ${head || '-'}`)
console.log(`manifest:   ${version}`)
console.log(`VERSION:    ${fileVer}`)
console.log(`Harus:      ${NEED} di branch ${KUNCI_BRANCH}`)

if (version !== NEED || branch !== KUNCI_BRANCH) {
  console.log(`
Chrome yang masih 1.2.4 artinya file di folder ini belum di-update.

${cmds.pull}
grep version kunci/extension/manifest.json

Baris version harus "${NEED}". Baru chrome://extensions → Remove → Load unpacked ke:

${EXTENSION_DIR}
`)
  process.exit(1)
}

console.log('\nFile sudah 1.2.9. Chrome unpacked di folder ini di-reload helper (http://127.0.0.1:8780). Clear all di Errors kalau badge masih nyala.')
