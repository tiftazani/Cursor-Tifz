import type { EncryptedBlob } from '../types'
import { vaultDb } from '../db/idb'

const TAB_KEY = 'kunci-refresh-tab'
const OLD_UNSAFE_KEY = 'kunci-refresh-session'

type StoredSession = { key: CryptoKey; tab: string; wrap: string; touchedAt: number }

function token(): string | null {
  try { return sessionStorage.getItem(TAB_KEY) } catch { return null }
}

function fingerprint(blob: EncryptedBlob): string {
  return `${blob.v}:${blob.salt}:${blob.wrapIv ?? ''}:${blob.wrap ?? ''}`
}

export const refreshSession = {
  async save(key: CryptoKey, blob: EncryptedBlob, now: number): Promise<void> {
    try {
      const tab = token() ?? crypto.randomUUID()
      await vaultDb.setRefreshSession({ key, tab, wrap: fingerprint(blob), touchedAt: now } satisfies StoredSession)
      sessionStorage.setItem(TAB_KEY, tab)
    } catch { /* On storage failure the vault remains usable until reload. */ }
  },
  async restore(blob: EncryptedBlob, now: number, seconds: number): Promise<CryptoKey | null> {
    const tab = token()
    if (!tab) return null
    try {
      const raw = await vaultDb.getRefreshSession() as Partial<StoredSession> | undefined
      if (!raw || raw.tab !== tab || raw.wrap !== fingerprint(blob) ||
          typeof raw.touchedAt !== 'number' || !Number.isFinite(raw.touchedAt) ||
          raw.touchedAt > now ||
          (seconds >= 0 && now - raw.touchedAt >= seconds * 1000) ||
          !(raw.key instanceof CryptoKey) || raw.key.extractable) {
        await this.clear()
        return null
      }
      return raw.key
    } catch {
      await this.clear()
      return null
    }
  },
  async touch(blob: EncryptedBlob, now: number, seconds: number): Promise<boolean> {
    const key = await this.restore(blob, now, seconds)
    if (!key) return false
    try {
      const raw = await vaultDb.getRefreshSession() as StoredSession | undefined
      if (raw?.tab === token() && raw.wrap === fingerprint(blob)) {
        await vaultDb.setRefreshSession({ ...raw, touchedAt: now })
        return true
      }
    } catch { /* Storage unavailable. */ }
    return false
  },
  async clear(): Promise<void> {
    try { sessionStorage.removeItem(TAB_KEY); sessionStorage.removeItem(OLD_UNSAFE_KEY) } catch { /* unavailable */ }
    try { await vaultDb.clearRefreshSession() } catch { /* unavailable */ }
  },
  cleanupOld(): void {
    try { sessionStorage.removeItem(OLD_UNSAFE_KEY) } catch { /* unavailable */ }
  },
}
