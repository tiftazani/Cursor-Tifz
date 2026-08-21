import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { EMPTY_VAULT, type EncryptedBlob, type Entry, type StoredBackup, type Vault, type VaultSettings } from '../types'
import { DEFAULT_SETTINGS } from '../types'
import { encryptVault, importDek, persistWithKey, rewrapWithPassword, unlockBlob, unlockWithDek } from '../lib/crypto'
import { vaultDb, pushIdbBackup } from '../db/idb'
import { withCredentialHistory } from '../lib/history'
import { entriesFromCsv } from '../lib/csv'
import { copyText, scheduleClipboardClear, sequentialCopy as runSequential } from '../lib/clipboard'
import { fillHelper, pingHelper } from '../lib/helper'
import { downloadBlob, parseBackupFile, writeFolderBackup } from '../lib/folder-backup'
import { notifyExtensionLock, syncExtension } from '../extension/bridge'
import { useToast } from '../components/Toast'
import { newId } from '../lib/id'
import { RECOVERY_EMAIL } from '../lib/account'
import { fetchResetDek, localToken, registerRecovery, requestPasswordReset as requestResetApi } from '../lib/recovery-api'

interface VaultApi {
  status: 'loading' | 'setup' | 'locked' | 'unlocked'
  vault: Vault | null
  hint: string
  busy: boolean
  helperOnline: boolean
  backups: StoredBackup[]
  backupFolderName: string | null
  setup: (password: string, hint: string) => Promise<void>
  unlock: (password: string) => Promise<void>
  requestPasswordReset: () => Promise<void>
  confirmPasswordReset: (code: string, newPassword: string) => Promise<void>
  recoveryEmail: string
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
        const blob = await vaultDb.getBlob()
        const storedHint = (await vaultDb.getHint()) ?? ''
        const storedBackups = await vaultDb.getBackups()
        const dir = await vaultDb.getBackupDir()
        if (cancelled) return
        blobRef.current = blob ?? null
        setHintState(storedHint)
        setBackups(storedBackups)
        setBackupFolderName(dir?.name ?? null)
        setStatus(blob ? 'locked' : 'setup')
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
      }
    })
    await persistChain.current
  }, [])

  const setup = useCallback(
    async (password: string, newHint: string) => {
      setBusy(true)
      try {
        const initial: Vault = { ...EMPTY_VAULT, settings: { ...DEFAULT_SETTINGS } }
        const { blob, key, dekBytes } = await encryptVault(initial, password)
        keyRef.current = key
        blobRef.current = blob
        await vaultDb.setBlob(blob)
        await vaultDb.setHint(newHint)
        await vaultDb.setCreatedAt(Date.now())
        setHintState(newHint)
        setVault(initial)
        setStatus('unlocked')
        syncExtension(blob)
        const rec = await registerRecovery(dekBytes, initial.settings.helperUrl)
        toast.push(
          rec.ok
            ? `Brankas dibuat. Reset kata sandi dikirim ke ${RECOVERY_EMAIL}.`
            : 'Brankas dibuat. Aktifkan layanan 24 jam (npm run install-service) supaya reset email jalan.',
          rec.ok ? 'ok' : 'warn',
        )
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
          await registerRecovery(migrated.dekBytes, normalizeVault(unlocked.data).settings.helperUrl)
        } else if (unlocked.dekBytes) {
          await registerRecovery(unlocked.dekBytes, normalizeVault(unlocked.data).settings.helperUrl)
        }
        keyRef.current = key
        blobRef.current = nextBlob
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
        await registerRecovery(created.dekBytes, current.settings.helperUrl)
      }
      keyRef.current = key
      blobRef.current = nextBlob
      await vaultDb.setBlob(nextBlob)
      syncExtension(nextBlob)
      toast.push('Kata sandi induk diganti')
    },
    [toast],
  )

  const requestPasswordReset = useCallback(async () => {
    const url = vaultRef.current?.settings.helperUrl
    const result = await requestResetApi(url)
    if (!result.ok) throw new Error(result.error || 'Gagal meminta reset')
    toast.push(`Kode reset dikirim ke ${RECOVERY_EMAIL}`)
  }, [toast])

  const confirmPasswordReset = useCallback(
    async (code: string, newPassword: string) => {
      const blob = blobRef.current ?? (await vaultDb.getBlob())
      if (!blob) throw new Error('Brankas belum dibuat')
      if (blob.v !== 2 || !blob.wrap) {
        throw new Error('Reset email butuh brankas versi baru. Buka sekali dengan kata sandi lama, lalu coba lagi.')
      }
      setBusy(true)
      try {
        const url = vaultRef.current?.settings.helperUrl
        const dekBytes = await fetchResetDek(code, url)
        const dek = await importDek(dekBytes)
        const data = await unlockWithDek<unknown>(blob, dek)
        const nextBlob = await rewrapWithPassword(blob, dek, newPassword)
        keyRef.current = dek
        blobRef.current = nextBlob
        await vaultDb.setBlob(nextBlob)
        const next = normalizeVault(data)
        setVault(next)
        setStatus('unlocked')
        syncExtension(nextBlob)
        await registerRecovery(dekBytes, next.settings.helperUrl)
        toast.push('Kata sandi diganti. Brankas terbuka.')
      } finally {
        setBusy(false)
      }
    },
    [toast],
  )

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
      setup,
      unlock,
      requestPasswordReset,
      confirmPasswordReset,
      recoveryEmail: RECOVERY_EMAIL,
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
      setup,
      unlock,
      requestPasswordReset,
      confirmPasswordReset,
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
