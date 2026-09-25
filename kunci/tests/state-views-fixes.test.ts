import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(__dirname, '..')
const read = (rel: string) => readFileSync(join(root, rel), 'utf8')
const strip = (s: string) => s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

const ctx = strip(read('src/state/VaultContext.tsx'))
const entryPane = read('src/views/EntryPane.tsx')
const appShell = read('src/views/AppShell.tsx')
const backupView = read('src/views/BackupView.tsx')
const recoveryModal = read('src/components/RecoveryKeyModal.tsx')

/**
 * The `deleg_7516cfee` audit report was lost to a context compaction; it was
 * recovered from the message store and every claim below re-checked against the
 * code. Each test names the live symptom the fix removes.
 */
describe('a save that failed does not report success', () => {
  it('persist reports whether the write landed', () => {
    // Live before: `persist` caught its own error and resolved normally, so every
    // caller believed the write succeeded. A full IndexedDB quota still produced
    // "Disimpan" while storage kept the old value; the edit vanished on reload.
    expect(ctx).toMatch(/const persist = useCallback\(async \([^)]*\): Promise<boolean> =>/)
    expect(ctx).toContain('let ok = true')
    expect(ctx).toContain('ok = false')
    expect(ctx).toContain('return ok')
  })

  it('the chain stays the pending promise so saves cannot interleave', () => {
    // Assigning `persistChain.current = run` (not awaiting it) is what serializes
    // concurrent saves; dropping that assignment let two writes race.
    expect(ctx).toContain('persistChain.current = run')
    expect(ctx).toContain('await run')
  })

  it('saveEntry returns the persist verdict instead of swallowing it', () => {
    expect(ctx).toMatch(/const saveEntry = useCallback\(\s*async \(entry: Entry, isNew = false\): Promise<boolean> =>/)
    expect(ctx).toMatch(/return persist\(next\)/)
  })

  it('EntryPane only says Disimpan when the write landed', () => {
    const save = entryPane.slice(entryPane.indexOf('async function save()'))
    const body = save.slice(0, 900)
    expect(body).toContain('const ok = await saveEntry(')
    expect(body).toContain('if (!ok) return')
    expect(body.indexOf('if (!ok) return')).toBeLessThan(body.indexOf("toast.push('Disimpan')"))
  })

  it('import, restore and backupNow gate their success toast too', () => {
    expect(ctx).toContain('if (!ok) return 0')
    expect(ctx).toMatch(/if \(ok\) toast\.push\(mode === 'replace'/)
    // backupNow must not download before the snapshot landed, nor announce it.
    const backupNow = ctx.slice(ctx.indexOf('const backupNow'))
    expect(backupNow.slice(0, 500)).toContain('const ok = await persist(current, \'manual\')')
    expect(backupNow.slice(0, 500)).toContain('if (!ok) return')
  })
})

describe('clipboard failures are visible, and nothing is claimed before it is tried', () => {
  it('sequentialCopy reports after the copy, not before', () => {
    // Live before: the toast "Username disalin. Password menyusul 6 detik." fired
    // before `runSequential`, so a blocked clipboard (NotAllowedError: Document is
    // not focused) announced a copy that never happened.
    const fn = ctx.slice(ctx.indexOf('const sequentialCopy = useCallback'))
    const body = fn.slice(0, 900)
    expect(body).toContain('await runSequential(')
    expect(body).toContain('catch')
    expect(body).toContain('Tidak bisa menyalin')
    // The first toast must come from inside the phase callback, i.e. after the copy.
    expect(body.indexOf('await runSequential(')).toBeLessThan(body.indexOf('Username disalin'))
  })

  it('a password-only entry still confirms the copy', () => {
    expect(ctx).toContain("if (phase === 'pass') toast.push(entry.username ? 'Password disalin — tempel sekarang' : 'Password disalin')")
  })

  it('the recovery key modal surfaces a blocked clipboard', () => {
    // Live before: `void copyText(...).then(...)` had no `.catch`, so a refusal left
    // the button reading "Salin" forever and told the user nothing.
    expect(recoveryModal).toContain('.catch(() => setCopyFailed(true))')
    expect(recoveryModal).toContain('Gagal menyalin')
  })

  it('copySecret already reported its failure', () => {
    expect(ctx).toContain('Tidak bisa menyalin')
  })
})

describe('backupKeep cannot be driven below the promised minimum', () => {
  it('clamps the input instead of trusting it', () => {
    // Live before: `min={3}` is only an HTML hint and `Number('')` is 0, so clearing
    // the box and saving once shrank the on-device snapshots from 3 to 1.
    expect(backupView).toContain('Math.max(3, Number(raw) || 3)')
    expect(backupView).toContain("if (raw.trim() === '') return")
  })
})

describe('an unsaved draft is not thrown away silently', () => {
  it('the pane reports dirtiness to the shell', () => {
    // Assert the call itself, not just the prop name: the name also appears in the
    // destructuring, so a substring check passed even with the effect gutted.
    expect(entryPane).toContain('onDirtyChange?.(dirty)')
    expect(entryPane).toContain('onDirtyChange?.(false)')
    expect(entryPane).toContain('JSON.stringify(draft) !== JSON.stringify(entry)')
  })

  it('the shell asks before a remount would drop the draft', () => {
    // Live before: `key` included `filter`, so switching a chip remounted EntryPane
    // and the local draft died with it — the entry silently reverted.
    expect(appShell).toContain('draftDirty')
    expect(appShell).toContain('Ada suntingan yang belum disimpan')
    expect(appShell).toMatch(/draftDirty \? '' : `-\$\{filter\}`/)
  })

  it('every path that unmounts the pane goes through the same guard', () => {
    // The chips were only one door. Changing view, starting a new entry, opening
    // another entry, and a search that hides the selected row all unmount the pane
    // the same way, so each one has to ask.
    expect(appShell).toContain('function confirmDiscard(what: string): boolean')
    const fn = appShell.slice(appShell.indexOf('function confirmDiscard'))
    expect(fn.slice(0, 400)).toContain('if (!draftDirty) return true')
    expect(fn.slice(0, 400)).toContain('window.confirm(`Ada suntingan yang belum disimpan. Buang dan ${what}?`)')

    const goView = appShell.slice(appShell.indexOf('function goView'))
    expect(goView.slice(0, 400)).toContain("confirmDiscard('pindah halaman')")
    const startNew = appShell.slice(appShell.indexOf('function startNew'))
    expect(startNew.slice(0, 300)).toContain("confirmDiscard('mulai entri baru')")
    const openEntry = appShell.slice(appShell.indexOf('function openEntry'))
    expect(openEntry.slice(0, 300)).toContain("confirmDiscard('buka entri lain')")
  })

  it('a search that hides the selected row keeps the pane mounted', () => {
    // `selected` came only from `filtered`; typing a query that excludes the entry
    // made it null, so the pane vanished and the draft with it.
    expect(appShell).toMatch(/draftDirty \? source\.find\(\(e\) => e\.id === selectedId\) : undefined/)
  })
})

describe('the trash pane shows what it is about to destroy', () => {
  it('renders the entry content, not just the name', () => {
    // Live before: a note entry showed only "Catatan Rahasia / Di sampah" with no way
    // to check the content before "Hapus permanen" destroyed it for good. Each field
    // is asserted through its own conditional, so gutting one is caught.
    const pane = entryPane.slice(entryPane.indexOf('if (inTrash)'), entryPane.indexOf('const strength ='))
    expect(pane).toContain('{entry.username ? (')
    expect(pane).toContain('{entry.password ? (')
    expect(pane).toContain('{entry.notes ? (')
    expect(pane).toContain('value={entry.notes} readOnly')
    expect(pane).toContain('window.confirm')
  })
})

describe('saving a hint gives feedback', () => {
  it('confirms and reports failure', () => {
    // Live before: the button produced no toast at all and a failed write rejected
    // with nobody watching.
    const fn = ctx.slice(ctx.indexOf('const setHint = useCallback'))
    const body = fn.slice(0, 500)
    expect(body).toContain("toast.push('Petunjuk disimpan')")
    expect(body).toContain('catch')
    expect(body).toContain('Gagal menyimpan petunjuk')
  })
})

describe('a TOTP field accepts the otpauth URI its hint promises', () => {
  it('parses the URI before decoding', () => {
    // No `strip` here: the comment stripper eats the `//` inside the regex literal.
    const totp = read('src/lib/totp.ts')
    expect(totp).toContain('otpauth:')
    expect(totp).toContain('parseOtpauth(secret)')
  })
})
