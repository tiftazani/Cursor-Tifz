import type { EncryptedBlob } from '../types'
import { isEncryptedBlob } from '../lib/crypto'

const SYNC = 'KUNCI_VAULT_SYNC'

export function syncExtension(blob: EncryptedBlob): void {
  window.postMessage({ type: SYNC, blob }, '*')
}

export function notifyExtensionLock(): void {
  window.postMessage({ type: 'KUNCI_VAULT_LOCK' }, '*')
}

export function requestExtensionBlob(): void {
  window.postMessage({ type: 'KUNCI_REQUEST_BLOB' }, '*')
}

export function listenExtensionVault(onBlob: (blob: EncryptedBlob) => void): () => void {
  const onMessage = (event: MessageEvent) => {
    if (event.source !== window) return
    if (event.data?.type === 'KUNCI_BLOB_FROM_EXT' && isEncryptedBlob(event.data.blob)) {
      onBlob(event.data.blob)
    }
  }
  window.addEventListener('message', onMessage)
  return () => window.removeEventListener('message', onMessage)
}
