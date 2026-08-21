import type { EncryptedBlob } from '../types'
import { KDF_ITERATIONS } from '../types'
import { b64ToBytes, bytesToB64, fromUtf8, utf8 } from './encoding'

export async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    utf8(password) as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export function newSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16))
}

export async function encryptWithKey(data: unknown, key: CryptoKey): Promise<{ iv: string; data: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = utf8(JSON.stringify(data))
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext as BufferSource,
  )
  return { iv: bytesToB64(iv), data: bytesToB64(new Uint8Array(cipher)) }
}

export async function decryptWithKey<T>(payload: { iv: string; data: string }, key: CryptoKey): Promise<T> {
  const iv = b64ToBytes(payload.iv)
  const data = b64ToBytes(payload.data)
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    data as BufferSource,
  )
  return JSON.parse(fromUtf8(plain)) as T
}

export async function encryptVault(
  data: unknown,
  password: string,
  iterations: number = KDF_ITERATIONS,
  salt: Uint8Array = newSalt(),
): Promise<{ blob: EncryptedBlob; key: CryptoKey }> {
  const key = await deriveKey(password, salt, iterations)
  const { iv, data: cipher } = await encryptWithKey(data, key)
  return {
    key,
    blob: {
      v: 1,
      kdf: 'PBKDF2-SHA256',
      iter: iterations,
      salt: bytesToB64(salt),
      iv,
      data: cipher,
    },
  }
}

export async function unlockBlob<T>(
  blob: EncryptedBlob,
  password: string,
): Promise<{ data: T; key: CryptoKey }> {
  if (blob.v !== 1 || blob.kdf !== 'PBKDF2-SHA256') {
    throw new Error('Format brankas tidak dikenali')
  }
  const salt = b64ToBytes(blob.salt)
  const key = await deriveKey(password, salt, blob.iter)
  const data = await decryptWithKey<T>(blob, key)
  return { data, key }
}

export async function persistWithKey(data: unknown, key: CryptoKey, blob: EncryptedBlob): Promise<EncryptedBlob> {
  const { iv, data: cipher } = await encryptWithKey(data, key)
  return { ...blob, iv, data: cipher }
}

export function isEncryptedBlob(value: unknown): value is EncryptedBlob {
  if (!value || typeof value !== 'object') return false
  const v = value as EncryptedBlob
  return v.v === 1 && v.kdf === 'PBKDF2-SHA256' && typeof v.salt === 'string' && typeof v.data === 'string'
}
