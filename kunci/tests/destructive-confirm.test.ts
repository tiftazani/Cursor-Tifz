import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(__dirname, '..')
const read = (rel: string) => readFileSync(join(root, rel), 'utf8')

const entryPane = read('src/views/EntryPane.tsx')
const appShell = read('src/views/AppShell.tsx')

/**
 * Destructive actions have to ask first. `purgeEntry` and `emptyTrash` both drop
 * records from `trash` outright — there is no undo, and the vault is the only copy
 * unless a backup happens to hold it.
 */
describe('purging an entry asks before destroying it', () => {
  it('confirms before calling purgeEntry', () => {
    // Live before: "Kosongkan" (the bulk action) asked with window.confirm, but the
    // single "Hapus permanen" button in the trash pane did not. One misclick
    // destroyed an entry for good, with no prompt and no way back.
    const button = entryPane.slice(entryPane.indexOf('btn btn-danger'))
    expect(button.slice(0, 700)).toContain('window.confirm')
    expect(button.slice(0, 700)).toContain('purgeEntry(entry.id)')
  })

  it('keeps the confirmation on the bulk action too', () => {
    expect(appShell).toContain('window.confirm')
    expect(appShell).toContain('emptyTrash()')
  })
})
