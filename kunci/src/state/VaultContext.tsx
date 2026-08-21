import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { EMPTY_VAULT, type EncryptedBlob, type Entry, type StoredBackup, type Vault, type VaultSettings } from '../types'
import { DEFAULT_SETTINGS } from '../types'
import {
  attachRecoveryWrap,
  encryptVault,
  hasRecoveryWrap,
  persistWithKey,
  rewrapWithPassword,
  unlockBlob,
  unlockWithDek,
  unlockWithRecoveryKey,
} from '../lib/crypto'
import { vaultDb, pushIdbBackup } from '../db/idb'
import { withCredentialHistory } from '../lib/history'
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
import { matchAppName } from '../lib/capture'

interface VaultApi {
  status: 'loading' | 'setup' | 'locked' | 'unlocked'
  vault: Vault | null
  hint: string
  busy: boolean
  helperOnline: boolean
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
  saveEntry: (entry: Entry, isNew?: boolean) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  restoreEntry: (id: string) => Promise<void>
  purgeEntry: (id: string) => Promise<void>
  emptyTrash: () => Promise<void>
  touchEntry: (id: string) => Promise<void>
  updateSettings: (patch: Partial<VaultSettings>) => Promise<void>
  changeMasterPassword: (current: string, next: string) => Promise<void>
  setHint: (hint: string) => Promise<void>
  exportBackup: () => Promise<void>
  restoreBackup: (json: unknown, password: string, mode: 'replace' | 'merge') => Promise<void>
  importCsvText: (text: string) => Promise<number>
  pickBackupFolder: () => Promise<void>
  backupNow: () => Promise<void>
  restoreIdbBackup: (id: string, password: string) => Promise<void>
  fillMac: (entry: Entry) => Promise<void>
  fillFrontmostApp: () => Promise<void>
  copySecret: (label: string, value: string) => Promise<void>
  sequentialCopy: (entry: Entry) => Promise<void>
  destroyVault: () => Promise<void>
}

const Ctx = createContext<VaultApi | null>(null)

function normalizeVault(raw: unknown): Vault {
  const v = raw as Partial<Vault>
  return {
    version: 1,
    entries: Array.isArray(v.entries) ? v.entries : [],
    trash: Array.isArray(v.trash) ? v.trash : [],
    settings: { ...DEFAULT_SETTINGS, ...(v.settings ?? {}) },
  }
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [status, setStatus] = useState<VaultApi['status']>('loading')
  const [vault, setVault] = useState<Vault | null>(null)
  const [hint, setHintState] = useState('')
  const [busy, setBusy] = useState(false)
  const [helperOnline, setHelperOnline] = useState(false)
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
    let cancelled = false
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
        setStatus(blob ? 'locked' : 'setup')
        requestExtensionBlob()
      } catch {
        if (!cancelled) setStatus('setup')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const persist = useCallback(async (next: Vault, reason: 'auto' | 'manual' | 'hourly' | 'daily' | 'none' = 'auto') => {
    const key = keyRef.current
    const blob = blobRef.current
    if (!key || !blob) throw new Error('Brankas terkunci')
    persistChain.current = persistChain.current.then(async () => {
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
      }
    })
    await persistChain.current
  }, [toast])

  useEffect(() => {
    const stop = listenExtensionVault((incoming) => {
      void (async () => {
        const current = blobRef.current
        if (current && (current.savedAt ?? 0) >= (incoming.savedAt ?? 0)) return
        blobRef.current = incoming
        setRecoveryWrapReady(hasRecoveryWrap(incoming))
        await vaultDb.setBlob(incoming)
        await cloudPutVault(incoming).catch(() => undefined)
        const key = keyRef.current
        if (key) {
          try {
            const next = normalizeVault(await unlockWithDek(incoming, key))
            vaultRef.current = next
            setVault(next)
          } catch {
            /* dek changed */
          }
        } else {
          setStatus((prev) => (prev === 'setup' ? 'locked' : prev))
        }
      })()
    })
    return stop
  }, [])

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
    keyRef.current = null
    setVault(null)
    setStatus('locked')
    notifyExtensionLock()
  }, [])

  const saveEntry = useCallback(
    async (entry: Entry, isNew = false) => {
      const current = vaultRef.current
      if (!current) return
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
    await logoutSession()
    keyRef.current = null
    setVault(null)
    setStatus(blobRef.current ? 'locked' : 'setup')
    notifyExtensionLock()
    window.location.reload()
  }, [])

  const setHint = useCallback(async (value: string) => {
    await vaultDb.setHint(value)
    setHintState(value)
  }, [])

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
      await persist(next, 'manual')
      toast.push(mode === 'replace' ? 'Brankas diganti dari cadangan' : 'Cadangan digabung')
    },
    [persist, toast],
  )

  const importCsvText = useCallback(
    async (text: string) => {
      const current = vaultRef.current
      if (!current) return 0
      const imported = entriesFromCsv(text)
      const next = { ...current, entries: [...imported, ...current.entries] }
      setVault(next)
      await persist(next)
      toast.push(`${imported.length} entri diimpor`)
      return imported.length
    },
    [persist, toast],
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
    const handle = await picker({ mode: 'readwrite' })
    await vaultDb.setBackupDir(handle)
    setBackupFolderName(handle.name)
    toast.push(`Folder cadangan: ${handle.name}`)
  }, [toast])

  const backupNow = useCallback(async () => {
    const current = vaultRef.current
    if (!current) return
    await persist(current, 'manual')
    await exportBackup()
    toast.push('Cadangan manual disimpan')
  }, [exportBackup, persist, toast])

  const restoreIdbBackup = useCallback(
    async (id: string, password: string) => {
      const item = backups.find((b) => b.id === id)
      if (!item) throw new Error('Cadangan tidak ditemukan')
      await restoreBackup({ blob: item.blob }, password, 'replace')
    },
    [backups, restoreBackup],
  )

  const fillMac = useCallback(
    async (entry: Entry) => {
      const current = vaultRef.current
      if (!current) return
      const result = await fillHelper(current.settings.helperUrl, current.settings.helperToken, {
        username: entry.username,
        password: entry.password,
        mode: entry.username && entry.password ? 'login' : 'password',
      })
      if (!result.ok) {
        toast.push(result.error ?? 'Gagal mengisi aplikasi Mac', 'danger')
        return
      }
      await touchEntry(entry.id)
      toast.push('Diketik ke aplikasi di depan')
    },
    [toast, touchEntry],
  )

  const fillFrontmostApp = useCallback(async () => {
    const current = vaultRef.current
    if (!current) return
    toast.push('Klik jendela app yang mau diisi — 2 detik…')
    await new Promise((resolve) => window.setTimeout(resolve, 2200))
    const app = await frontmostApp(current.settings.helperUrl)
    if (!app) {
      toast.push('Tidak bisa membaca app di depan. Izinkan Accessibility untuk Node.', 'warn')
      return
    }
    const matches = matchAppName(current.entries, app).sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0))
    if (!matches.length) {
      toast.push(`Tidak ada login untuk ${app}. Simpan dulu sebagai tipe Aplikasi Mac.`, 'warn')
      return
    }
    await fillMac(matches[0]!)
  }, [fillMac, toast])

  const copySecret = useCallback(
    async (label: string, value: string) => {
      if (!value) return
      await copyText(value)
      const seconds = vaultRef.current?.settings.clipboardSeconds ?? 20
      clearClipRef.current()
      clearClipRef.current = scheduleClipboardClear(seconds, value, () => {
        toast.push('Papan klip dibersihkan')
      })
      toast.push(`${label} disalin${seconds ? ` · hapus otomatis ${seconds} dtk` : ''}`)
    },
    [toast],
  )

  const sequentialCopy = useCallback(
    async (entry: Entry) => {
      const gap = vaultRef.current?.settings.sequentialCopySeconds ?? 6
      toast.push(entry.username ? `Username disalin. Password menyusul ${gap} detik.` : 'Password disalin')
      await runSequential(entry.username, entry.password, gap, (phase) => {
        if (phase === 'pass' && entry.username) toast.push('Password disalin — tempel sekarang')
      })
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
    const minutes = vault.settings.autoLockMinutes
    if (minutes <= 0) return
    let timer: number
    const bump = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => lock(), minutes * 60_000)
    }
    bump()
    window.addEventListener('pointerdown', bump)
    window.addEventListener('keydown', bump)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointerdown', bump)
      window.removeEventListener('keydown', bump)
    }
  }, [status, vault?.settings.autoLockMinutes, lock, vault])

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
      if (!cancelled) setHelperOnline(s.ok)
    }
    void ping()
    const id = window.setInterval(ping, 8000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [status, vault?.settings.helperUrl, vault])

  useEffect(() => {
    if (status !== 'unlocked') return
    let cancelled = false
    void (async () => {
      const current = vaultRef.current
      if (!current) return
      const token = await localToken(current.settings.helperUrl)
      if (cancelled || !token || token === current.settings.helperToken) return
      await updateSettings({ helperToken: token })
    })()
    return () => {
      cancelled = true
    }
  }, [status, updateSettings])

  const api = useMemo<VaultApi>(
    () => ({
      status,
      vault,
      hint,
      busy,
      helperOnline,
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
      deleteEntry,
      restoreEntry,
      purgeEntry,
      emptyTrash,
      touchEntry,
      updateSettings,
      changeMasterPassword,
      setHint,
      exportBackup,
      restoreBackup,
      importCsvText,
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
      deleteEntry,
      restoreEntry,
      purgeEntry,
      emptyTrash,
      touchEntry,
      updateSettings,
      changeMasterPassword,
      setHint,
      exportBackup,
      restoreBackup,
      importCsvText,
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
