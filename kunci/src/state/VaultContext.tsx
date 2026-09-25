import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { EMPTY_VAULT, type EncryptedBlob, type Entry, type StoredBackup, type Vault, type VaultSettings } from '../types'
import { DEFAULT_SETTINGS } from '../types'
import {
  attachRecoveryWrap,
  encryptVault,
  hasRecoveryWrap,
  persistWithKey,
  rewrapWithPassword,
  sessionKey,
  unlockBlob,
  unlockWithDek,
  unlockWithRecoveryKey,
} from '../lib/crypto'
import { vaultDb, pushIdbBackup } from '../db/idb'
import { withCredentialHistory } from '../lib/history'
import { mergeEntriesInto } from '../lib/duplicates'
import { entriesFromCsv } from '../lib/csv'
import { copyText, scheduleClipboardClear, sequentialCopy as runSequential } from '../lib/clipboard'
import { fillHelper, frontmostApp, pingHelper } from '../lib/helper'
import { downloadBlob, parseBackupFile, writeFolderBackup } from '../lib/folder-backup'
import { listenExtensionVault, notifyExtensionLock, requestExtensionBlob, syncExtension } from '../extension/bridge'
import { useToast } from '../components/Toast'
import { newId } from '../lib/id'
import { RECOVERY_EMAIL } from '../lib/account'
import { localToken } from '../lib/recovery-api'
import { cloudGetVault, cloudPutVault, emailRecoveryKey, isPublicHost, logoutSession } from '../lib/cloud'
import { resolveAutoLockSeconds } from '../lib/autolock'
import { refreshSession } from '../lib/refresh-session'
import { matchAppName } from '../lib/capture'
import { moveAndroidToTrash } from '../lib/cleanup'
import { isPreviewUi, previewVault } from '../lib/preview-vault'

interface VaultApi {
  status: 'loading' | 'setup' | 'locked' | 'unlocked'
  vault: Vault | null
  hint: string
  busy: boolean
  helperOnline: boolean
  helperAccessibility: boolean
  helperAppInstalled: boolean
  helperAppPath: string
  helperRepoRoot: string
  helperKunciRoot: string
  helperExtensionDir: string
  helperExtensionVersion: string
  /** Commands the daemon built from the real paths on this Mac. Empty when the
   *  helper is offline, which is exactly when the UI shows the generic steps. */
  helperPull: string
  helperInstall: string
  backups: StoredBackup[]
  backupFolderName: string | null
  pendingRecoveryKey: string | null
  hasRecoveryWrap: boolean
  publicHost: boolean
  setup: (password: string, hint: string) => Promise<void>
  unlock: (password: string) => Promise<void>
  confirmPasswordReset: (recoveryKey: string, newPassword: string) => Promise<void>
  dismissRecoveryKey: () => void
  rotateRecoveryKey: () => Promise<void>
  emailPendingRecoveryKey: () => Promise<boolean>
  recoveryEmail: string
  logoutPublic: () => Promise<void>
  lock: () => void
  saveEntry: (entry: Entry, isNew?: boolean) => Promise<boolean>
  mergeEntries: (keepId: string, dropIds: string[]) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  restoreEntry: (id: string) => Promise<void>
  purgeEntry: (id: string) => Promise<void>
  emptyTrash: () => Promise<void>
  /** Move a whole selection to the trash in one write. Returns how many moved. */
  trashEntries: (ids: string[]) => Promise<number>
  /** Delete a selection from the trash for good. Returns how many were removed. */
  purgeEntries: (ids: string[]) => Promise<number>
  /** Move every Android app login to the trash. Returns how many moved. */
  removeAndroidEntries: () => Promise<number>
  touchEntry: (id: string) => Promise<void>
  updateSettings: (patch: Partial<VaultSettings>) => Promise<void>
  changeMasterPassword: (current: string, next: string) => Promise<void>
  setHint: (hint: string) => Promise<void>
  exportBackup: () => Promise<void>
  restoreBackup: (json: unknown, password: string, mode: 'replace' | 'merge') => Promise<void>
  importCsvText: (text: string) => Promise<number>
  importPlainEntries: (entries: Entry[]) => Promise<number>
  pickBackupFolder: () => Promise<void>
  backupNow: () => Promise<void>
  restoreIdbBackup: (id: string, password: string) => Promise<void>
  fillMac: (entry: Entry, opts?: { appName?: string; waitMs?: number }) => Promise<void>
  fillFrontmostApp: (entry?: Entry) => Promise<void>
  copySecret: (label: string, value: string) => Promise<void>
  sequentialCopy: (entry: Entry) => Promise<void>
  destroyVault: () => Promise<void>
}

const Ctx = createContext<VaultApi | null>(null)

function normalizeVault(raw: unknown): Vault {
  const v = raw as Partial<Vault>
  const settingsIn = (v.settings ?? {}) as VaultSettings & { autoLockMinutes?: number }
  return {
    version: 1,
    entries: Array.isArray(v.entries) ? v.entries : [],
    trash: Array.isArray(v.trash) ? v.trash : [],
    settings: {
      ...DEFAULT_SETTINGS,
      ...settingsIn,
      autoLockSeconds: resolveAutoLockSeconds(settingsIn),
    },
  }
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [status, setStatus] = useState<VaultApi['status']>('loading')
  const [vault, setVault] = useState<Vault | null>(null)
  const [hint, setHintState] = useState('')
  const [busy, setBusy] = useState(false)
  const [helperOnline, setHelperOnline] = useState(false)
  const [helperAccessibility, setHelperAccessibility] = useState(false)
  const [helperAppInstalled, setHelperAppInstalled] = useState(false)
  const [helperAppPath, setHelperAppPath] = useState('')
  const [helperRepoRoot, setHelperRepoRoot] = useState('')
  const [helperKunciRoot, setHelperKunciRoot] = useState('')
  const [helperExtensionDir, setHelperExtensionDir] = useState('')
  const [helperExtensionVersion, setHelperExtensionVersion] = useState('')
  // Commands come from the daemon so the real home path never reaches the bundle.
  const [helperPull, setHelperPull] = useState('')
  const [helperInstall, setHelperInstall] = useState('')
  const [backups, setBackups] = useState<StoredBackup[]>([])
  const [backupFolderName, setBackupFolderName] = useState<string | null>(null)
  const [pendingRecoveryKey, setPendingRecoveryKey] = useState<string | null>(null)
  const [recoveryWrapReady, setRecoveryWrapReady] = useState(false)
  const keyRef = useRef<CryptoKey | null>(null)
  const blobRef = useRef<EncryptedBlob | null>(null)
  const vaultRef = useRef<Vault | null>(null)
  const clearClipRef = useRef<() => void>(() => {})
  const persistChain = useRef(Promise.resolve())

  useEffect(() => {
    vaultRef.current = vault
  }, [vault])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return
      if (event.data?.type !== 'KUNCI_PULL_BLOB') return
      if (blobRef.current) syncExtension(blobRef.current)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  useEffect(() => {
    if (isPreviewUi()) {
      const demo = previewVault()
      vaultRef.current = demo
      setVault(demo)
      setStatus('unlocked')
      return
    }
    let cancelled = false
    refreshSession.cleanupOld()
    void (async () => {
      try {
        let blob = (await vaultDb.getBlob()) ?? null
        const remote = await cloudGetVault()
        if (remote && (!blob || (remote.savedAt ?? 0) >= (blob.savedAt ?? 0))) {
          blob = remote
          await vaultDb.setBlob(remote)
        } else if (blob && (!remote || (blob.savedAt ?? 0) > (remote.savedAt ?? 0))) {
          await cloudPutVault(blob).catch(() => undefined)
        }
        const storedHint = (await vaultDb.getHint()) ?? ''
        const storedBackups = await vaultDb.getBackups()
        const dir = await vaultDb.getBackupDir()
        if (cancelled) return
        blobRef.current = blob
        setRecoveryWrapReady(blob ? hasRecoveryWrap(blob) : false)
        setHintState(storedHint)
        setBackups(storedBackups)
        setBackupFolderName(dir?.name ?? null)
        if (blob) {
          const key = await refreshSession.restore(blob, Date.now(), -1)
          if (key) {
            try {
              const restored = normalizeVault(await unlockWithDek<unknown>(blob, key))
              if (cancelled) return
              if (!await refreshSession.restore(blob, Date.now(), resolveAutoLockSeconds(restored.settings))) {
                throw new Error('Sesi tidak aktif')
              }
              keyRef.current = key
              vaultRef.current = restored
              setVault(restored)
              setStatus('unlocked')
            } catch {
              await refreshSession.clear()
              if (!cancelled) setStatus('locked')
            }
          } else setStatus('locked')
        } else {
          await refreshSession.clear()
          setStatus('setup')
        }
        requestExtensionBlob()
      } catch {
        if (!cancelled) setStatus('setup')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const persist = useCallback(async (next: Vault, reason: 'auto' | 'manual' | 'hourly' | 'daily' | 'none' = 'auto'): Promise<boolean> => {
    if (isPreviewUi()) {
      vaultRef.current = next
      setVault(next)
      return true
    }
    const key = keyRef.current
    const blob = blobRef.current
    if (!key || !blob) throw new Error('Brankas terkunci')
    let ok = true
    const run = persistChain.current
      .then(async () => {
        const updated = await persistWithKey(next, key, blob)
        blobRef.current = updated
        await vaultDb.setBlob(updated)
        syncExtension(updated)
        try {
          await cloudPutVault(updated)
        } catch (err) {
          toast.push(err instanceof Error ? err.message : 'Gagal sinkron cloud', 'warn')
        }
        const mode = next.settings.autoBackup
        const shouldSnap =
          reason === 'manual' ||
          reason === 'hourly' ||
          reason === 'daily' ||
          (reason === 'auto' && mode === 'on-change')
        if (shouldSnap) {
          const snapReason: StoredBackup['reason'] =
            reason === 'manual' || reason === 'hourly' || reason === 'daily' ? reason : 'auto'
          const list = await pushIdbBackup(updated, snapReason, next.settings.backupKeep)
          setBackups(list)
          const dir = await vaultDb.getBackupDir()
          if (dir) {
            try {
              await writeFolderBackup(dir, updated, next.settings.backupKeep)
            } catch {
              /* folder optional */
            }
          }
          const stamped = {
            ...next,
            settings: { ...next.settings, lastAutoBackupAt: Date.now() },
          }
          const again = await persistWithKey(stamped, key, updated)
          blobRef.current = again
          await vaultDb.setBlob(again)
          syncExtension(again)
          try {
            await cloudPutVault(again)
          } catch (err) {
            toast.push(err instanceof Error ? err.message : 'Gagal sinkron cloud', 'warn')
          }
          // The stamp has to reach the React state too. The auto-backup scheduler
          // reads it from vaultRef, so writing it to storage alone meant the
          // guard never saw it: "hourly" took a snapshot every 60 seconds.
          vaultRef.current = stamped
          setVault(stamped)
        }
      })
      .catch((err) => {
        // Without this the chain stayed rejected forever: one failure (a full
        // IndexedDB quota, a write during a page clear) made every later save a
        // no-op while the UI kept showing the change as saved.
        ok = false
        toast.push(err instanceof Error ? `Gagal menyimpan: ${err.message}` : 'Gagal menyimpan', 'danger')
      })
    // The chain must stay the *pending* promise, not this call's result, or two
    // saves in flight run concurrently and the slower one wins.
    persistChain.current = run
    await run
    return ok
  }, [toast])

  useEffect(() => {
    const stop = listenExtensionVault((incoming) => {
      void (async () => {
        const current = blobRef.current
        if (current && (current.savedAt ?? 0) >= (incoming.savedAt ?? 0)) return
        const key = keyRef.current
        // Decrypt BEFORE adopting anything. This used to write the incoming blob to
        // IndexedDB and the cloud first and only then try the key, swallowing the
        // failure. When the two sides held different DEKs (a second browser did the
        // v1→v2 migration), that left blobRef pointing at a blob this key cannot
        // open while `vault` still held the old plaintext — and the next save wrote
        // the old key's ciphertext into the new blob's salt/wrap, producing a vault
        // that opened with NEITHER password. The blob is now only adopted once this
        // key has proven it can read it.
        if (key) {
          try {
            const next = normalizeVault(await unlockWithDek(incoming, key))
            blobRef.current = incoming
            setRecoveryWrapReady(hasRecoveryWrap(incoming))
            vaultRef.current = next
            setVault(next)
            await vaultDb.setBlob(incoming)
            await cloudPutVault(incoming).catch(() => undefined)
          } catch {
            // A different key owns this blob. Keep the local copy as the source of
            // truth rather than overwriting it with something we cannot read.
            toast.push('Brankas di cloud diubah dari perangkat lain. Buka ulang dengan kata sandi induk yang baru.', 'warn')
          }
          return
        }
        blobRef.current = incoming
        setRecoveryWrapReady(hasRecoveryWrap(incoming))
        await vaultDb.setBlob(incoming)
        await cloudPutVault(incoming).catch(() => undefined)
        setStatus((prev) => (prev === 'setup' ? 'locked' : prev))
      })()
    })
    return stop
  }, [toast])

  const setup = useCallback(
    async (password: string, newHint: string) => {
      setBusy(true)
      try {
        const initial: Vault = { ...EMPTY_VAULT, settings: { ...DEFAULT_SETTINGS } }
        const { blob, key, recoveryKey } = await encryptVault(initial, password)
        keyRef.current = key
        blobRef.current = blob
        await vaultDb.setBlob(blob)
        await vaultDb.setHint(newHint)
        await vaultDb.setCreatedAt(Date.now())
        setHintState(newHint)
        setVault(initial)
        setStatus('unlocked')
        await refreshSession.save(await sessionKey(key), blob, Date.now())
        setRecoveryWrapReady(true)
        setPendingRecoveryKey(recoveryKey)
        syncExtension(blob)
        try {
          await cloudPutVault(blob)
        } catch (err) {
          toast.push(err instanceof Error ? err.message : 'Gagal sinkron cloud', 'warn')
        }
        toast.push('Brankas dibuat. Simpan recovery key di tempat yang aman.', 'ok')
      } finally {
        setBusy(false)
      }
    },
    [toast],
  )

  const unlock = useCallback(
    async (password: string) => {
      const blob = blobRef.current ?? (await vaultDb.getBlob())
      if (!blob) throw new Error('Brankas belum dibuat')
      setBusy(true)
      try {
        const unlocked = await unlockBlob<unknown>(blob, password)
        let nextBlob = blob
        let key = unlocked.key
        if (blob.v === 1) {
          const migrated = await encryptVault(unlocked.data, password)
          nextBlob = migrated.blob
          key = migrated.key
          await vaultDb.setBlob(nextBlob)
          setPendingRecoveryKey(migrated.recoveryKey)
          try {
            await cloudPutVault(nextBlob)
          } catch {
            /* local still works */
          }
        } else if (unlocked.dekBytes && !hasRecoveryWrap(nextBlob)) {
          const attached = await attachRecoveryWrap(nextBlob, key)
          nextBlob = attached.blob
          await vaultDb.setBlob(nextBlob)
          setPendingRecoveryKey(attached.recoveryKey)
          try {
            await cloudPutVault(nextBlob)
          } catch {
            /* local still works */
          }
        }
        keyRef.current = key
        blobRef.current = nextBlob
        setRecoveryWrapReady(hasRecoveryWrap(nextBlob))
        const next = normalizeVault(unlocked.data)
        setVault(next)
        setStatus('unlocked')
        await refreshSession.save(await sessionKey(key), nextBlob, Date.now())
        syncExtension(nextBlob)
      } catch {
        throw new Error('Kata sandi induk salah')
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  const lock = useCallback(() => {
    void refreshSession.clear()
    keyRef.current = null
    setVault(null)
    setStatus('locked')
    notifyExtensionLock()
  }, [])

  const saveEntry = useCallback(
    async (entry: Entry, isNew = false): Promise<boolean> => {
      const current = vaultRef.current
      if (!current) return false
      let entries: Entry[]
      if (isNew) {
        entries = [entry, ...current.entries]
      } else {
        const prev = current.entries.find((e) => e.id === entry.id)
        const saved = prev ? withCredentialHistory(prev, entry) : { ...entry, updatedAt: Date.now() }
        entries = current.entries.map((e) => (e.id === saved.id ? saved : e))
      }
      const next = { ...current, entries }
      setVault(next)
      return persist(next)
    },
    [persist],
  )

  const mergeEntries = useCallback(
    async (keepId: string, dropIds: string[]) => {
      const current = vaultRef.current
      if (!current) return
      const uniqueDrop = [...new Set(dropIds.filter((id) => id && id !== keepId))]
      if (!uniqueDrop.length) return
      const keep = current.entries.find((e) => e.id === keepId)
      if (!keep) throw new Error('Entri yang disimpan tidak ada')
      const others = uniqueDrop
        .map((id) => current.entries.find((e) => e.id === id))
        .filter((e): e is Entry => Boolean(e))
      if (!others.length) return
      const merged = mergeEntriesInto(keep, others)
      const dropSet = new Set(others.map((e) => e.id))
      const next: Vault = {
        ...current,
        entries: current.entries.map((e) => (e.id === merged.id ? merged : e)).filter((e) => !dropSet.has(e.id)),
        trash: [...others.map((e) => ({ ...e, updatedAt: Date.now() })), ...current.trash],
      }
      setVault(next)
      await persist(next)
    },
    [persist],
  )

  const deleteEntry = useCallback(
    async (id: string) => {
      const current = vaultRef.current
      if (!current) return
      const found = current.entries.find((e) => e.id === id)
      if (!found) return
      const next: Vault = {
        ...current,
        entries: current.entries.filter((e) => e.id !== id),
        trash: [{ ...found, updatedAt: Date.now() }, ...current.trash],
      }
      setVault(next)
      await persist(next)
    },
    [persist],
  )

  const restoreEntry = useCallback(
    async (id: string) => {
      const current = vaultRef.current
      if (!current) return
      const found = current.trash.find((e) => e.id === id)
      if (!found) return
      const next: Vault = {
        ...current,
        trash: current.trash.filter((e) => e.id !== id),
        entries: [{ ...found, updatedAt: Date.now() }, ...current.entries],
      }
      setVault(next)
      await persist(next)
    },
    [persist],
  )

  const purgeEntry = useCallback(
    async (id: string) => {
      const current = vaultRef.current
      if (!current) return
      const next = { ...current, trash: current.trash.filter((e) => e.id !== id) }
      setVault(next)
      await persist(next)
    },
    [persist],
  )

  const emptyTrash = useCallback(async () => {
    const current = vaultRef.current
    if (!current) return
    const next = { ...current, trash: [] }
    setVault(next)
    await persist(next)
  }, [persist])

  /**
   * Move a whole selection to the trash in one write.
   *
   * One `persist` for the group, not one per entry: twenty separate writes would
   * re-encrypt and re-upload the vault twenty times, and a failure halfway would leave
   * half the selection moved with no way to tell which half.
   */
  const trashEntries = useCallback(
    async (ids: string[]) => {
      const current = vaultRef.current
      if (!current) return 0
      const drop = new Set(ids)
      const found = current.entries.filter((e) => drop.has(e.id))
      if (!found.length) return 0
      const next: Vault = {
        ...current,
        entries: current.entries.filter((e) => !drop.has(e.id)),
        trash: [...found.map((e) => ({ ...e, updatedAt: Date.now() })), ...current.trash],
      }
      setVault(next)
      await persist(next)
      return found.length
    },
    [persist],
  )

  /** Delete a selection from the trash for good, in one write. */
  const purgeEntries = useCallback(
    async (ids: string[]) => {
      const current = vaultRef.current
      if (!current) return 0
      const drop = new Set(ids)
      const kept = current.trash.filter((e) => !drop.has(e.id))
      const removed = current.trash.length - kept.length
      if (!removed) return 0
      const next = { ...current, trash: kept }
      setVault(next)
      await persist(next)
      return removed
    },
    [persist],
  )

  /**
   * Remove every entry saved from an Android app, in one go.
   * They go to the trash, not straight out, so a mistake is recoverable.
   * Returns how many were moved.
   */
  const removeAndroidEntries = useCallback(async (): Promise<number> => {
    const current = vaultRef.current
    if (!current) return 0
    const { vault: next, moved } = moveAndroidToTrash(current)
    if (!moved) return 0
    setVault(next)
    await persist(next)
    return moved
  }, [persist])

  const touchEntry = useCallback(
    async (id: string) => {
      const current = vaultRef.current
      if (!current) return
      const next = {
        ...current,
        entries: current.entries.map((e) => (e.id === id ? { ...e, lastUsedAt: Date.now() } : e)),
      }
      setVault(next)
      await persist(next, 'none')
    },
    [persist],
  )

  const updateSettings = useCallback(
    async (patch: Partial<VaultSettings>) => {
      const current = vaultRef.current
      if (!current) return
      const next = { ...current, settings: { ...current.settings, ...patch } }
      setVault(next)
      await persist(next, 'none')
    },
    [persist],
  )

  const changeMasterPassword = useCallback(
    async (currentPassword: string, nextPassword: string) => {
      const blob = blobRef.current
      const current = vaultRef.current
      if (!blob || !current) throw new Error('Brankas terkunci')
      const unlocked = await unlockBlob<unknown>(blob, currentPassword)
      let nextBlob: EncryptedBlob
      let key = unlocked.key
      if (unlocked.dekBytes && blob.wrap) {
        nextBlob = await rewrapWithPassword(blob, unlocked.key, nextPassword)
      } else {
        const created = await encryptVault(current, nextPassword)
        nextBlob = created.blob
        key = created.key
        setPendingRecoveryKey(created.recoveryKey)
      }
      keyRef.current = key
      blobRef.current = nextBlob
      await vaultDb.setBlob(nextBlob)
      await refreshSession.save(await sessionKey(key), nextBlob, Date.now())
      syncExtension(nextBlob)
      try {
        await cloudPutVault(nextBlob)
      } catch (err) {
        toast.push(err instanceof Error ? err.message : 'Gagal sinkron cloud', 'warn')
      }
      toast.push('Kata sandi induk diganti')
    },
    [toast],
  )

  const confirmPasswordReset = useCallback(
    async (recoveryKey: string, newPassword: string) => {
      const blob = blobRef.current ?? (await vaultDb.getBlob())
      if (!blob) throw new Error('Brankas belum dibuat')
      if (!hasRecoveryWrap(blob)) {
        throw new Error('Brankas ini belum punya recovery key. Buka sekali dengan kata sandi lama, lalu simpan kunci baru.')
      }
      setBusy(true)
      try {
        const { dek } = await unlockWithRecoveryKey(blob, recoveryKey.trim())
        const data = await unlockWithDek<unknown>(blob, dek)
        const nextBlob = await rewrapWithPassword(blob, dek, newPassword)
        keyRef.current = dek
        blobRef.current = nextBlob
        await vaultDb.setBlob(nextBlob)
        const next = normalizeVault(data)
        setVault(next)
        setStatus('unlocked')
        await refreshSession.save(await sessionKey(dek), nextBlob, Date.now())
        setRecoveryWrapReady(true)
        syncExtension(nextBlob)
        try {
          await cloudPutVault(nextBlob)
        } catch (err) {
          toast.push(err instanceof Error ? err.message : 'Gagal sinkron cloud', 'warn')
        }
        toast.push('Kata sandi diganti. Brankas terbuka.')
      } catch (err) {
        if (err instanceof Error && err.message.startsWith('Brankas ini belum')) throw err
        throw new Error('Recovery key salah atau brankas rusak')
      } finally {
        setBusy(false)
      }
    },
    [toast],
  )

  const dismissRecoveryKey = useCallback(() => {
    setPendingRecoveryKey(null)
  }, [])

  const rotateRecoveryKey = useCallback(async () => {
    const blob = blobRef.current
    const key = keyRef.current
    if (!blob || !key) throw new Error('Buka brankas dulu')
    const attached = await attachRecoveryWrap(blob, key)
    blobRef.current = attached.blob
    await vaultDb.setBlob(attached.blob)
    syncExtension(attached.blob)
    setRecoveryWrapReady(true)
    setPendingRecoveryKey(attached.recoveryKey)
    try {
      await cloudPutVault(attached.blob)
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Gagal sinkron cloud', 'warn')
    }
    toast.push('Recovery key baru dibuat. Yang lama tidak berlaku.')
  }, [toast])

  const emailPendingRecoveryKey = useCallback(async () => {
    if (!pendingRecoveryKey) return false
    return emailRecoveryKey(pendingRecoveryKey)
  }, [pendingRecoveryKey])

  const logoutPublic = useCallback(async () => {
    await refreshSession.clear()
    await logoutSession()
    keyRef.current = null
    setVault(null)
    setStatus(blobRef.current ? 'locked' : 'setup')
    notifyExtensionLock()
    window.location.reload()
  }, [])

  const setHint = useCallback(async (value: string) => {
    try {
      await vaultDb.setHint(value)
      setHintState(value)
      toast.push('Petunjuk disimpan')
    } catch (err) {
      // This used to be a bare await with no feedback, so the button looked dead
      // and a failed write rejected with nobody watching.
      toast.push(err instanceof Error ? `Gagal menyimpan petunjuk: ${err.message}` : 'Gagal menyimpan petunjuk', 'danger')
    }
  }, [toast])

  const exportBackup = useCallback(async () => {
    const blob = blobRef.current
    if (!blob) return
    downloadBlob(`kunci-backup-${new Date().toISOString().slice(0, 10)}.json`, {
      app: 'kunci',
      exportedAt: Date.now(),
      blob,
    })
    toast.push('Cadangan terenkripsi diunduh')
  }, [toast])

  const restoreBackup = useCallback(
    async (json: unknown, password: string, mode: 'replace' | 'merge') => {
      const fileBlob = parseBackupFile(json)
      const { data } = await unlockBlob<unknown>(fileBlob, password)
      const incoming = normalizeVault(data)
      const current = vaultRef.current
      const key = keyRef.current
      if (!current || !key) throw new Error('Buka brankas dulu')
      let next: Vault
      if (mode === 'replace') {
        next = { ...incoming, settings: { ...current.settings, ...incoming.settings } }
      } else {
        const seen = new Set(current.entries.map((e) => e.id))
        const merged = [...current.entries]
        for (const e of incoming.entries) {
          if (!seen.has(e.id)) merged.push(e)
          else {
            const i = merged.findIndex((x) => x.id === e.id)
            if (i >= 0 && e.updatedAt > merged[i]!.updatedAt) merged[i] = e
          }
        }
        next = { ...current, entries: merged }
      }
      setVault(next)
      const ok = await persist(next, 'manual')
      if (ok) toast.push(mode === 'replace' ? 'Brankas diganti dari cadangan' : 'Cadangan digabung')
    },
    [persist, toast],
  )

  const importPlainEntries = useCallback(
    async (imported: Entry[]) => {
      const current = vaultRef.current
      if (!current) return 0
      if (!imported.length) {
        toast.push('Tidak ada baris username/password yang bisa diimpor', 'warn')
        return 0
      }
      const next = { ...current, entries: [...imported, ...current.entries] }
      setVault(next)
      const ok = await persist(next)
      // Only claim the import landed if it really did: `persist` used to swallow the
      // write error, so a full quota still produced "N entri diimpor ke brankas".
      if (!ok) return 0
      toast.push(`${imported.length} entri diimpor ke brankas`)
      return imported.length
    },
    [persist, toast],
  )

  const importCsvText = useCallback(
    async (text: string) => importPlainEntries(entriesFromCsv(text)),
    [importPlainEntries],
  )

  const pickBackupFolder = useCallback(async () => {
    const picker = (
      window as Window & {
        showDirectoryPicker?: (opts?: { mode?: 'readwrite' }) => Promise<FileSystemDirectoryHandle>
      }
    ).showDirectoryPicker
    if (typeof picker !== 'function') {
      toast.push('Browser ini tidak mendukung folder cadangan otomatis. Gunakan Chrome atau Edge.', 'warn')
      return
    }
    // Cancelling the picker rejects with AbortError. That is a normal answer, not
    // a failure: say nothing and leave the previous folder in place.
    let handle: FileSystemDirectoryHandle
    try {
      handle = await picker({ mode: 'readwrite' })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      toast.push('Gagal memilih folder cadangan', 'danger')
      return
    }
    await vaultDb.setBackupDir(handle)
    setBackupFolderName(handle.name)
    toast.push(`Folder cadangan: ${handle.name}`)
  }, [toast])

  const backupNow = useCallback(async () => {
    const current = vaultRef.current
    if (!current) return
    // Order matters: snapshot first, download only if it landed. This used to
    // announce "Cadangan manual disimpan" even when the write failed.
    const ok = await persist(current, 'manual')
    if (!ok) return
    await exportBackup()
  }, [exportBackup, persist])

  const restoreIdbBackup = useCallback(
    async (id: string, password: string) => {
      const item = backups.find((b) => b.id === id)
      if (!item) throw new Error('Cadangan tidak ditemukan')
      await restoreBackup({ blob: item.blob }, password, 'replace')
    },
    [backups, restoreBackup],
  )

  const fillMac = useCallback(
    async (entry: Entry, opts?: { appName?: string; waitMs?: number }) => {
      const current = vaultRef.current
      if (!current) return
      const appName = (opts?.appName || entry.appName || '').trim()
      const result = await fillHelper(current.settings.helperUrl, current.settings.helperToken, {
        username: entry.username,
        password: entry.password,
        mode: entry.username && entry.password ? 'login' : 'password',
        appName,
        waitMs: opts?.waitMs || 0,
      })
      if (!result.ok) {
        toast.push(result.error ?? 'Gagal mengisi aplikasi Mac', 'danger')
        return
      }
      await touchEntry(entry.id)
      toast.push(result.app ? `Username/password diisi ke ${result.app}` : 'Username/password diisi ke aplikasi di depan')
    },
    [toast, touchEntry],
  )

  const fillFrontmostApp = useCallback(
    async (entry?: Entry) => {
      const current = vaultRef.current
      if (!current) return
      toast.push('Klik jendela app yang mau diisi — 4 detik…')
      await new Promise((resolve) => window.setTimeout(resolve, 4000))
      const app = await frontmostApp(current.settings.helperUrl, current.settings.helperToken)
      if (!app) {
        toast.push('Tidak bisa membaca app di depan. Izinkan Accessibility untuk Node dan osascript.', 'warn')
        return
      }
      const chosen =
        entry ||
        matchAppName(current.entries, app).sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0))[0]
      if (!chosen) {
        toast.push(`Tidak ada login untuk ${app}. Simpan dulu sebagai tipe Aplikasi Mac.`, 'warn')
        return
      }
      await fillMac(chosen, { appName: app })
    },
    [fillMac, toast],
  )

  const copySecret = useCallback(
    async (label: string, value: string) => {
      if (!value) return
      // `navigator.clipboard.writeText` rejects on an unfocused document and in
      // some browsers without a user gesture. The rejection used to escape: the
      // caller did `void copySecret(...)`, so nothing was copied and nothing said
      // so — the user concluded the app had hung.
      try {
        await copyText(value)
      } catch {
        toast.push(`Tidak bisa menyalin ${label.toLowerCase()} — klik halaman dulu, lalu coba lagi`, 'danger')
        return
      }
      const seconds = vaultRef.current?.settings.clipboardSeconds ?? 20
      clearClipRef.current()
      clearClipRef.current = scheduleClipboardClear(seconds, value, (cleared) => {
        toast.push(cleared ? 'Papan klip dibersihkan' : 'Papan klip tidak bisa dibersihkan — hapus manual', cleared ? 'ok' : 'warn')
      })
      toast.push(`${label} disalin${seconds ? ` · hapus otomatis ${seconds} dtk` : ''}`)
    },
    [toast],
  )

  const sequentialCopy = useCallback(
    async (entry: Entry) => {
      const gap = vaultRef.current?.settings.sequentialCopySeconds ?? 6
      // Announce nothing up front. The old code pushed "Username disalin. Password
      // menyusul 6 detik." before copying, so a blocked clipboard (NotAllowedError:
      // Document is not focused) still claimed success and nothing was copied.
      try {
        await runSequential(entry.username, entry.password, gap, (phase) => {
          if (phase === 'user') toast.push(`Username disalin. Password menyusul ${gap} detik.`)
          // Password-only entries never emit "user", so they land here directly.
          if (phase === 'pass') toast.push(entry.username ? 'Password disalin — tempel sekarang' : 'Password disalin')
        })
      } catch {
        toast.push('Tidak bisa menyalin — klik halaman dulu, lalu coba lagi', 'danger')
        return
      }
      await touchEntry(entry.id)
      const seconds = vaultRef.current?.settings.clipboardSeconds ?? 20
      if (entry.password) {
        clearClipRef.current()
        clearClipRef.current = scheduleClipboardClear(seconds, entry.password)
      }
    },
    [toast, touchEntry],
  )

  const destroyVault = useCallback(async () => {
    await refreshSession.clear()
    await vaultDb.destroy()
    keyRef.current = null
    blobRef.current = null
    setVault(null)
    setBackups([])
    setBackupFolderName(null)
    setHintState('')
    setPendingRecoveryKey(null)
    setRecoveryWrapReady(false)
    setStatus('setup')
    notifyExtensionLock()
    toast.push('Brankas dihapus dari perangkat ini', 'warn')
  }, [toast])

  useEffect(() => {
    if (status !== 'unlocked' || !vault) return
    // The preview harness unlocks without ever producing a blob or a session key, so
    // the inactivity machinery has nothing to validate against and would lock the demo
    // the moment the idle timer fired. It is fixtures only and holds no real vault, so
    // there is no session to protect.
    if (isPreviewUi()) return
    const seconds = resolveAutoLockSeconds(vault.settings)
    const lockNow = () => lock()
    if (seconds < 0) return
    const onVisible = () => {
      if (document.hidden) return
      // A missing blob means there is no refresh session to check. Locking is the safe
      // answer, and it is also what `bump` does, so both paths agree.
      const blob = blobRef.current
      if (!blob) {
        lockNow()
        return
      }
      void refreshSession.restore(blob, Date.now(), seconds).then((key) => {
        if (!key) lockNow()
      })
    }

    if (seconds === 0) {
      const onVisibility = () => {
        if (document.hidden) lockNow()
      }
      const onBlur = () => lockNow()
      document.addEventListener('visibilitychange', onVisibility)
      window.addEventListener('blur', onBlur)
      return () => {
        document.removeEventListener('visibilitychange', onVisibility)
        window.removeEventListener('blur', onBlur)
      }
    }

    let timer: number
    const bump = () => {
      const blob = blobRef.current
      if (!blob) return lockNow()
      void refreshSession.touch(blob, Date.now(), seconds).then((valid) => {
        if (keyRef.current === null) return
        if (!valid) { lockNow(); return }
        window.clearTimeout(timer)
        timer = window.setTimeout(lockNow, seconds * 1000)
      })
    }
    timer = window.setTimeout(lockNow, seconds * 1000)
    const opts = { passive: true } as const
    window.addEventListener('pointerdown', bump, opts)
    window.addEventListener('keydown', bump)
    window.addEventListener('mousemove', bump, opts)
    window.addEventListener('scroll', bump, opts)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pointerdown', bump)
      window.removeEventListener('keydown', bump)
      window.removeEventListener('mousemove', bump)
      window.removeEventListener('scroll', bump)
    }
  }, [status, vault?.settings.autoLockSeconds, lock, vault])

  useEffect(() => {
    if (status !== 'unlocked' || !vault) return
    const mode = vault.settings.autoBackup
    if (mode !== 'hourly' && mode !== 'daily') return
    const tick = () => {
      const last = vaultRef.current?.settings.lastAutoBackupAt ?? 0
      const span = mode === 'hourly' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
      if (Date.now() - last >= span && vaultRef.current) {
        void persist(vaultRef.current, mode)
      }
    }
    tick()
    const id = window.setInterval(tick, 60_000)
    return () => window.clearInterval(id)
  }, [status, vault?.settings.autoBackup, persist, vault])

  useEffect(() => {
    if (status !== 'unlocked' || !vault) return
    let cancelled = false
    const ping = async () => {
      const s = await pingHelper(vault.settings.helperUrl)
      if (cancelled) return
      setHelperOnline(s.ok)
      setHelperAccessibility(Boolean(s.accessibility))
      setHelperAppInstalled(Boolean(s.helperApp))
      setHelperAppPath(s.helperAppPath || '')
      setHelperRepoRoot(s.repoRoot || '')
      setHelperKunciRoot(s.kunciRoot || '')
      setHelperExtensionDir(s.extensionDir || '')
      setHelperExtensionVersion(s.extensionVersion || '')
      setHelperPull(s.pull || '')
      setHelperInstall(s.install || '')
      if (s.ok) {
        const token = await localToken(vault.settings.helperUrl)
        const current = vaultRef.current
        if (!cancelled && token && current && token !== current.settings.helperToken) {
          await updateSettings({ helperToken: token })
        }
      }
    }
    void ping()
    const id = window.setInterval(ping, 8000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [status, vault?.settings.helperUrl, vault, updateSettings])

  const api = useMemo<VaultApi>(
    () => ({
      status,
      vault,
      hint,
      busy,
      helperOnline,
      helperAccessibility,
      helperAppInstalled,
      helperAppPath,
      helperRepoRoot,
      helperKunciRoot,
      helperExtensionDir,
      helperExtensionVersion,
      helperPull,
      helperInstall,
      backups,
      backupFolderName,
      pendingRecoveryKey,
      hasRecoveryWrap: recoveryWrapReady,
      publicHost: isPublicHost(),
      setup,
      unlock,
      confirmPasswordReset,
      dismissRecoveryKey,
      rotateRecoveryKey,
      emailPendingRecoveryKey,
      recoveryEmail: RECOVERY_EMAIL,
      logoutPublic,
      lock,
      saveEntry,
      mergeEntries,
      deleteEntry,
      restoreEntry,
      purgeEntry,
      emptyTrash,
      trashEntries,
      purgeEntries,
      removeAndroidEntries,
      touchEntry,
      updateSettings,
      changeMasterPassword,
      setHint,
      exportBackup,
      restoreBackup,
      importCsvText,
      importPlainEntries,
      pickBackupFolder,
      backupNow,
      restoreIdbBackup,
      fillMac,
      fillFrontmostApp,
      copySecret,
      sequentialCopy,
      destroyVault,
    }),
    [
      status,
      vault,
      hint,
      busy,
      helperOnline,
      helperAccessibility,
      helperAppInstalled,
      helperAppPath,
      helperRepoRoot,
      helperKunciRoot,
      helperExtensionDir,
      helperExtensionVersion,
      helperPull,
      helperInstall,
      backups,
      backupFolderName,
      pendingRecoveryKey,
      recoveryWrapReady,
      setup,
      unlock,
      confirmPasswordReset,
      dismissRecoveryKey,
      rotateRecoveryKey,
      emailPendingRecoveryKey,
      logoutPublic,
      lock,
      saveEntry,
      mergeEntries,
      deleteEntry,
      restoreEntry,
      purgeEntry,
      emptyTrash,
      trashEntries,
      purgeEntries,
      removeAndroidEntries,
      touchEntry,
      updateSettings,
      changeMasterPassword,
      setHint,
      exportBackup,
      restoreBackup,
      importCsvText,
      importPlainEntries,
      pickBackupFolder,
      backupNow,
      restoreIdbBackup,
      fillMac,
      fillFrontmostApp,
      copySecret,
      sequentialCopy,
      destroyVault,
    ],
  )

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useVault(): VaultApi {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useVault outside provider')
  return ctx
}

export function blankEntry(type: Entry['type'] = 'login'): Entry {
  const now = Date.now()
  return {
    id: newId(),
    type,
    name: '',
    urls: [],
    tags: [],
    favorite: false,
    customFields: [],
    history: [],
    createdAt: now,
    updatedAt: now,
  }
}
