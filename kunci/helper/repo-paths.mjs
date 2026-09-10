import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))

/** Folder `kunci/` on disk — not a hardcoded ~/tifz-apps or ~/Cursor. */
export const KUNCI_ROOT = join(here, '..')
/** Git clone root (parent of `kunci/`). */
export const REPO_ROOT = join(KUNCI_ROOT, '..')
export const EXTENSION_DIR = join(KUNCI_ROOT, 'extension')
export const KUNCI_BRANCH = 'cursor/kunci-password-manager-4eaf'

const EXTENSION_WATCH = [
  'manifest.json',
  'VERSION',
  'background.js',
  'content.js',
  'crypto.js',
  'ext-api.js',
  'login-intent.js',
  'login-outcome.js',
  'popup.js',
  'popup.html',
  'content.css',
  'icon16.png',
  'icon48.png',
  'icon128.png',
]

export function extensionOnDisk() {
  const manifestPath = join(EXTENSION_DIR, 'manifest.json')
  let extensionVersion = ''
  try {
    extensionVersion = JSON.parse(readFileSync(manifestPath, 'utf8')).version || ''
  } catch {
    extensionVersion = ''
  }
  let mtime = 0
  for (const name of EXTENSION_WATCH) {
    const path = join(EXTENSION_DIR, name)
    if (!existsSync(path)) continue
    try {
      mtime = Math.max(mtime, statSync(path).mtimeMs)
    } catch {
      /* ignore */
    }
  }
  let gitHead = ''
  try {
    const result = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' })
    if (result.status === 0) gitHead = (result.stdout || '').trim()
  } catch {
    /* not a git checkout */
  }
  return {
    extensionDir: EXTENSION_DIR,
    extensionVersion,
    extensionStamp: `${extensionVersion}:${gitHead}:${Math.round(mtime)}`,
  }
}

export function refreshCommands() {
  return {
    repoRoot: REPO_ROOT,
    kunciRoot: KUNCI_ROOT,
    pull: `cd ${REPO_ROOT} && git config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*" && git fetch origin ${KUNCI_BRANCH} && (test -z "$(git status --porcelain)" || git stash push -u -m "sebelum kunci branch") && git checkout -B ${KUNCI_BRANCH} FETCH_HEAD && test -f kunci/src/views/DashboardView.tsx`,
    install: `cd ${KUNCI_ROOT} && npm install && npm run install-service`,
    ...extensionOnDisk(),
  }
}

