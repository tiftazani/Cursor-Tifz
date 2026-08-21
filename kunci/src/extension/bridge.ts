import type { EncryptedBlob } from '../types'

const SYNC = 'KUNCI_VAULT_SYNC'

export function syncExtension(blob: EncryptedBlob): void {
  window.postMessage({ type: SYNC, blob }, '*')
}

export function notifyExtensionLock(): void {
  window.postMessage({ type: 'KUNCI_VAULT_LOCK' }, '*')
}
