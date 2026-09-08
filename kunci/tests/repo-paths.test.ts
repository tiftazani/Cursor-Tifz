import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { EXTENSION_DIR, KUNCI_ROOT, REPO_ROOT, refreshCommands } from '../helper/repo-paths.mjs'

describe('repo paths follow the files on disk', () => {
  it('points at this kunci tree, not a hardcoded ~/tifz-apps', () => {
    expect(existsSync(join(KUNCI_ROOT, 'package.json'))).toBe(true)
    expect(existsSync(join(EXTENSION_DIR, 'manifest.json'))).toBe(true)
    expect(existsSync(join(REPO_ROOT, 'README.md'))).toBe(true)
    const cmds = refreshCommands()
    expect(cmds.pull).toContain(REPO_ROOT)
    expect(cmds.install).toContain(KUNCI_ROOT)
    expect(cmds.pull).toContain('checkout -B')
    expect(cmds.pull).toContain('FETCH_HEAD')
    expect(cmds.pull).not.toContain('origin/cursor/')
    expect(cmds.pull).not.toContain('git pull')
  })
})
