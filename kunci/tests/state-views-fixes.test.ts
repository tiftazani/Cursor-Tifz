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
    // The pane key must NOT be derived from `draftDirty`. An earlier attempt keyed
    // it on that flag, which remounted the pane the moment the first keystroke set
    // it — every edit was destroyed as it was typed and no entry could be saved.
    expect(appShell).not.toMatch(/key=\{`\$\{selected\.id\}-\$\{selected\.updatedAt\}\$\{draftDirty/)
    expect(appShell).toContain('key={`${selected.id}-${selected.updatedAt}-${paneEpoch}`}')
    expect(appShell).toContain('const [paneEpoch, setPaneEpoch] = useState(0)')
    // Dropping the draft on purpose is what bumps the epoch.
    const confirmFn = appShell.slice(appShell.indexOf('function confirmDiscard'))
    expect(confirmFn.slice(0, 500)).toContain('setPaneEpoch((e) => e + 1)')
  })

  it('a keydown handler that registers once still sees the current guard', () => {
    // The listener's deps are `[lock]`, so it closed over the `startNew` from the
    // first render — where `draftDirty` was false. ⌘N then skipped the confirm
    // while the mouse button asked correctly. A ref keeps it current.
    expect(appShell).toContain('const startNewRef = useRef(startNew)')
    expect(appShell).toContain('startNewRef.current = startNew')
    const onKey = appShell.slice(appShell.indexOf('function onKey'))
    expect(onKey.slice(0, 400)).toContain('startNewRef.current()')
    expect(onKey.slice(0, 400)).not.toMatch(/^\s*startNew\(\)$/m)
  })

  it('the compact back button asks too', () => {
    // In the phone layout this is the only exit from the detail pane, so it is the
    // one door that matters most there.
    const back = appShell.slice(appShell.indexOf('function backToList'))
    expect(back.slice(0, 300)).toContain("confirmDiscard('kembali ke daftar')")
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
    // Masked, like the editor: verify what you are destroying, do not print it.
    expect(pane).toContain('<SecretInput value={entry.password}')
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

describe('a rejected vault action never escapes unhandled', () => {
  it('SetupScreen catches a failed vault creation', () => {
    // Live before: `await setup(...)` sat outside any try. `setup` writes the blob,
    // the hint and the creation stamp to IndexedDB; a blocked store rejected with
    // nobody watching, the button stopped saying "Menyiapkan…" and nothing else
    // happened. Assert the exact shape — a plain `indexOf('try {')` check passed
    // even with the catch replaced by a dead `else if`, because -1 sorts first.
    const gate = read('src/views/Gate.tsx')
    expect(gate).toMatch(/try \{\s*await setup\(password, hint\.trim\(\)\)\s*\} catch \(err\) \{/)
    expect(gate).toContain('Gagal membuat brankas')
  })

  it('settings actions report a rejection', () => {
    const settings = read('src/views/SettingsView.tsx')
    // `rotateRecoveryKey` throws when locked; `destroyVault` rejects if the
    // IndexedDB delete fails, and the vault is then still on disk.
    expect(settings).toContain('void rotateRecoveryKey().catch(')
    expect(settings).toContain('void destroyVault().catch(')
    expect(settings).toContain('void logoutPublic().catch(')
    expect(settings).toContain('Gagal membuat recovery key baru')
    expect(settings).toContain('Gagal menghapus brankas')
  })

  it('EntryPane mutations go through the guarded helper', () => {
    // `persist` throws "Brankas terkunci" when auto-lock fires between opening the
    // pane and pressing the button, so every one of these could reject.
    expect(entryPane).toContain('function run(fn: Promise<unknown>, what: string)')
    expect(entryPane).toContain("run(restoreEntry(entry.id), 'memulihkan')")
    expect(entryPane).toContain("run(purgeEntry(entry.id), 'menghapus')")
    expect(entryPane).toContain("run(deleteEntry(draft.id), 'membuang')")
    expect(entryPane).not.toContain('void purgeEntry(entry.id)')
  })

  it('saving reports a locked vault instead of going quiet', () => {
    const save = entryPane.slice(entryPane.indexOf('async function save()'))
    const body = save.slice(0, 1100)
    expect(body).toContain("toast.push(err instanceof Error ? err.message : 'Gagal menyimpan', 'danger')")
  })
})

describe('a number box cannot silently write 0', () => {
  it('settings numbers commit only a clamped, non-empty value', () => {
    // Live before: `onChange={(e) => void updateSettings({ clipboardSeconds:
    // Number(e.target.value) })}`. Clearing the box wrote 0, which the clipboard
    // code reads as "never auto-clear", and the copy gap announced
    // "Password menyusul 0 detik". `min`/`max` are HTML hints React never enforces.
    const settings = read('src/views/SettingsView.tsx')
    expect(settings).toContain('function NumberField(')
    expect(settings).toContain('onCommit')
    expect(settings).toContain('Math.min(max, Math.max(min, Math.round(n)))')
    expect(settings).toContain("if (text.trim() === '' || !Number.isFinite(n))")
    // The raw onChange writes must be gone.
    expect(settings).not.toContain('updateSettings({ clipboardSeconds: Number(e.target.value) })')
    expect(settings).not.toContain('updateSettings({ sequentialCopySeconds: Number(e.target.value) })')
    expect(settings).toContain('onCommit={(n) => void updateSettings({ clipboardSeconds: n })}')
    expect(settings).toContain('onCommit={(n) => void updateSettings({ sequentialCopySeconds: n })}')
  })
})

describe('the recovery-key email button reports its failure', () => {
  it('catches a rejected send instead of going quiet', () => {
    // Live before: `void onEmail().then(...).finally(...)` with no `.catch`, so a
    // network failure left the button reading "Kirim ke Gmail (kurang aman)" with
    // no error text and an unhandled rejection. The sibling copy button was
    // already fixed for exactly this.
    const modal = read('src/components/RecoveryKeyModal.tsx')
    expect(modal).toContain(".catch(() => setEmailed('fail'))")
    expect(modal).toContain("emailed === 'fail'")
    expect(modal).toContain('Gagal mengirim email')
  })
})

describe('cancelling a picker is not an error', () => {
  it('pickBackupFolder treats AbortError as a normal answer', () => {
    // Live before: `const handle = await picker(...)` with no try, so Esc/Cancel on
    // the macOS folder dialog logged an unhandled AbortError and said nothing.
    const fn = ctx.slice(ctx.indexOf('const pickBackupFolder'))
    const body = fn.slice(0, 1200)
    expect(body).toContain('try {')
    expect(body).toContain("err.name === 'AbortError'")
    expect(body).toContain('Gagal memilih folder cadangan')
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
