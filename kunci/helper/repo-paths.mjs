import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

/** Folder `kunci/` on disk — not a hardcoded ~/tifz-apps or ~/Cursor. */
export const KUNCI_ROOT = join(here, '..')
/** Git clone root (parent of `kunci/`). */
export const REPO_ROOT = join(KUNCI_ROOT, '..')
export const EXTENSION_DIR = join(KUNCI_ROOT, 'extension')
export const KUNCI_BRANCH = 'cursor/kunci-password-manager-4eaf'

export function refreshCommands() {
  return {
    repoRoot: REPO_ROOT,
    kunciRoot: KUNCI_ROOT,
    extensionDir: EXTENSION_DIR,
    pull: `cd ${REPO_ROOT} && git fetch origin && git checkout ${KUNCI_BRANCH} && git pull origin ${KUNCI_BRANCH}`,
    install: `cd ${KUNCI_ROOT} && npm install && npm run install-service`,
  }
}
