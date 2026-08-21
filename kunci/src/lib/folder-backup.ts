import type { EncryptedBlob } from '../types'

type PermissionedDirectory = FileSystemDirectoryHandle & {
  queryPermission?: (descriptor: { mode: 'readwrite' }) => Promise<PermissionState>
  requestPermission?: (descriptor: { mode: 'readwrite' }) => Promise<PermissionState>
}

export async function ensureDirPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const dir = handle as PermissionedDirectory
  if (typeof dir.queryPermission !== 'function') return true
  const q = await dir.queryPermission({ mode: 'readwrite' })
  if (q === 'granted') return true
  if (typeof dir.requestPermission !== 'function') return false
  const r = await dir.requestPermission({ mode: 'readwrite' })
  return r === 'granted'
}

function stamp(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`
}

export async function writeFolderBackup(
  dir: FileSystemDirectoryHandle,
  blob: EncryptedBlob,
  keep: number,
): Promise<void> {
  const ok = await ensureDirPermission(dir)
  if (!ok) throw new Error('Izin folder cadangan ditolak')
  const payload = JSON.stringify({ exportedAt: Date.now(), app: 'kunci', blob }, null, 2)
  const latest = await dir.getFileHandle('kunci-backup-latest.json', { create: true })
  const dated = await dir.getFileHandle(`kunci-backup-${stamp()}.json`, { create: true })
  for (const handle of [latest, dated]) {
    const writable = await handle.createWritable()
    await writable.write(payload)
    await writable.close()
  }
  await pruneFolderBackups(dir, keep)
}

async function pruneFolderBackups(dir: FileSystemDirectoryHandle, keep: number): Promise<void> {
  const names: string[] = []
  for await (const [name] of dir.entries()) {
    if (name.startsWith('kunci-backup-') && name.endsWith('.json') && name !== 'kunci-backup-latest.json') {
      names.push(name)
    }
  }
  names.sort()
  const extra = names.slice(0, Math.max(0, names.length - keep))
  for (const name of extra) {
    await dir.removeEntry(name)
  }
}

export function downloadBlob(filename: string, json: unknown): void {
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function parseBackupFile(json: unknown): EncryptedBlob {
  if (!json || typeof json !== 'object') throw new Error('File cadangan rusak')
  const raw = json as { blob?: EncryptedBlob; v?: number; data?: string }
  if (raw.blob && raw.blob.v === 1 && raw.blob.data) return raw.blob
  if (raw.v === 1 && typeof raw.data === 'string') return raw as EncryptedBlob
  throw new Error('File bukan cadangan Kunci yang terenkripsi')
}
