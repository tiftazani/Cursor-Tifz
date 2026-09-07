import type { EncryptedBlob, StoredBackup } from '../types'

const DB_NAME = 'kunci-vault'
const DB_VERSION = 1
const STORE = 'kv'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      dbPromise = null
      reject(req.error)
    }
  })
  return dbPromise
}

async function get<T>(key: string): Promise<T | undefined> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

async function set(key: string, value: unknown): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function del(key: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export const vaultDb = {
  getBlob: () => get<EncryptedBlob>('blob'),
  setBlob: (blob: EncryptedBlob) => set('blob', blob),
  getHint: () => get<string>('hint'),
  setHint: (hint: string) => set('hint', hint),
  getCreatedAt: () => get<number>('createdAt'),
  setCreatedAt: (ms: number) => set('createdAt', ms),
  getBackups: async () => (await get<StoredBackup[]>('backups')) ?? [],
  setBackups: (backups: StoredBackup[]) => set('backups', backups),
  getBackupDir: () => get<FileSystemDirectoryHandle>('backupDir'),
  setBackupDir: (handle: FileSystemDirectoryHandle | null) =>
    handle ? set('backupDir', handle) : del('backupDir'),
  destroy: async () => {
    await del('blob')
    await del('hint')
    await del('createdAt')
    await del('backups')
    await del('backupDir')
  },
}

export async function pushIdbBackup(
  blob: EncryptedBlob,
  reason: StoredBackup['reason'],
  keep: number,
): Promise<StoredBackup[]> {
  const current = await vaultDb.getBackups()
  const next: StoredBackup[] = [
    { id: crypto.randomUUID(), createdAt: Date.now(), reason, blob },
    ...current,
  ].slice(0, Math.max(1, keep))
  await vaultDb.setBackups(next)
  return next
}
