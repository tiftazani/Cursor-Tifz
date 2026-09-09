#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { EXTENSION_DIR, KUNCI_BRANCH, KUNCI_ROOT, REPO_ROOT, extensionOnDisk } from '../helper/repo-paths.mjs'

function run(args) {
  const result = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function gitOut(args) {
  const result = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' })
  return (result.stdout || '').trim()
}

console.log(`Repo: ${REPO_ROOT}`)
run(['config', 'remote.origin.fetch', '+refs/heads/*:refs/remotes/origin/*'])
run(['fetch', 'origin', KUNCI_BRANCH])
if (gitOut(['status', '--porcelain'])) {
  console.log('Working tree kotor — stash dulu. Lihat: git stash list')
  run(['stash', 'push', '-u', '-m', 'sebelum kunci branch'])
}
run(['checkout', '-B', KUNCI_BRANCH, 'FETCH_HEAD'])

const dash = join(KUNCI_ROOT, 'src', 'views', 'DashboardView.tsx')
if (!existsSync(dash)) {
  console.error('DashboardView.tsx tidak ada. Masih tree lama — jangan install-service.')
  process.exit(1)
}

console.log(`Branch: ${gitOut(['rev-parse', '--abbrev-ref', 'HEAD'])}`)
console.log(`Commit: ${gitOut(['rev-parse', '--short', 'HEAD'])}`)
const ext = extensionOnDisk()
console.log(`Ekstensi: ${EXTENSION_DIR} (${ext.extensionVersion})`)
console.log('File Ringkasan sudah ada. Lanjut npm run install-service — Chrome unpacked akan reload sendiri.')
