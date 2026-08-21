export type EntryType = 'login' | 'app' | 'password' | 'note' | 'totp'

export interface HistoryRecord {
  id: string
  username?: string
  password?: string
  changedAt: number
}

export interface CustomField {
  id: string
  label: string
  value: string
  hidden: boolean
}

export interface Entry {
  id: string
  type: EntryType
  name: string
  username?: string
  password?: string
  url?: string
  urls: string[]
  appName?: string
  notes?: string
  totpSecret?: string
  tags: string[]
  favorite: boolean
  customFields: CustomField[]
  history: HistoryRecord[]
  createdAt: number
  updatedAt: number
  lastUsedAt?: number
  passwordChangedAt?: number
}

export type AutoBackupMode = 'off' | 'on-change' | 'hourly' | 'daily'

export interface VaultSettings {
  autoLockMinutes: number
  clipboardSeconds: number
  autoBackup: AutoBackupMode
  backupKeep: number
  hibpEnabled: boolean
  theme: 'dark' | 'light' | 'system'
  helperUrl: string
  helperToken: string
  sequentialCopySeconds: number
  lastAutoBackupAt?: number
}

export interface Vault {
  version: 1
  entries: Entry[]
  trash: Entry[]
  settings: VaultSettings
}

export interface EncryptedBlob {
  v: 1 | 2
  kdf: 'PBKDF2-SHA256'
  iter: number
  salt: string
  iv: string
  data: string
  wrapIv?: string
  wrap?: string
}

export interface StoredBackup {
  id: string
  createdAt: number
  reason: 'auto' | 'manual' | 'hourly' | 'daily'
  blob: EncryptedBlob
}

export const KDF_ITERATIONS = 600_000

export const DEFAULT_SETTINGS: VaultSettings = {
  autoLockMinutes: 5,
  clipboardSeconds: 20,
  autoBackup: 'on-change',
  backupKeep: 12,
  hibpEnabled: true,
  theme: 'dark',
  helperUrl: 'http://127.0.0.1:8780',
  helperToken: '',
  sequentialCopySeconds: 6,
}

export const EMPTY_VAULT: Vault = {
  version: 1,
  entries: [],
  trash: [],
  settings: { ...DEFAULT_SETTINGS },
}

export type FilterId =
  | 'all'
  | 'favorite'
  | 'login'
  | 'app'
  | 'password'
  | 'note'
  | 'totp'
  | 'trash'

export type AppView =
  | 'vault'
  | 'generator'
  | 'health'
  | 'history'
  | 'autofill'
  | 'backup'
  | 'settings'
