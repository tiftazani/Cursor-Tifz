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

export async function generateDek(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

export async function exportDek(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey('raw', key))
}

export async function importDek(bytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', bytes as BufferSource, { name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ])
}

export async function encryptBytes(bytes: Uint8Array, key: CryptoKey): Promise<{ iv: string; data: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes as BufferSource)
  return { iv: bytesToB64(iv), data: bytesToB64(new Uint8Array(cipher)) }
}

export async function decryptBytes(payload: { iv: string; data: string }, key: CryptoKey): Promise<Uint8Array> {
  const iv = b64ToBytes(payload.iv)
  const data = b64ToBytes(payload.data)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, data as BufferSource)
  return new Uint8Array(plain)
}

export async function encryptWithKey(data: unknown, key: CryptoKey): Promise<{ iv: string; data: string }> {
  return encryptBytes(utf8(JSON.stringify(data)), key)
}

export async function decryptWithKey<T>(payload: { iv: string; data: string }, key: CryptoKey): Promise<T> {
  return JSON.parse(fromUtf8(await decryptBytes(payload, key) as BufferSource)) as T
}

export async function encryptVault(
  data: unknown,
  password: string,
  iterations: number = KDF_ITERATIONS,
  salt: Uint8Array = newSalt(),
): Promise<{ blob: EncryptedBlob; key: CryptoKey; dekBytes: Uint8Array }> {
  const dek = await generateDek()
  const dekBytes = await exportDek(dek)
  const kek = await deriveKey(password, salt, iterations)
  const wrap = await encryptBytes(dekBytes, kek)
  const vault = await encryptWithKey(data, dek)
  return {
    key: dek,
    dekBytes,
    blob: {
      v: 2,
      kdf: 'PBKDF2-SHA256',
      iter: iterations,
      salt: bytesToB64(salt),
      wrapIv: wrap.iv,
      wrap: wrap.data,
      iv: vault.iv,
      data: vault.data,
    },
  }
}

export async function rewrapWithPassword(
  blob: EncryptedBlob,
  dek: CryptoKey,
  password: string,
): Promise<EncryptedBlob> {
  const salt = newSalt()
  const kek = await deriveKey(password, salt, blob.iter || KDF_ITERATIONS)
  const dekBytes = await exportDek(dek)
  const wrap = await encryptBytes(dekBytes, kek)
  return {
    ...blob,
    v: 2,
    salt: bytesToB64(salt),
    wrapIv: wrap.iv,
    wrap: wrap.data,
  }
}

export async function unlockWithDek<T>(blob: EncryptedBlob, dek: CryptoKey): Promise<T> {
  return decryptWithKey<T>(blob, dek)
}

export async function unlockBlob<T>(
  blob: EncryptedBlob,
  password: string,
): Promise<{ data: T; key: CryptoKey; dekBytes?: Uint8Array }> {
  if ((blob.v !== 1 && blob.v !== 2) || blob.kdf !== 'PBKDF2-SHA256') {
    throw new Error('Format brankas tidak dikenali')
  }
  const salt = b64ToBytes(blob.salt)
  const kek = await deriveKey(password, salt, blob.iter)
  if (blob.v === 1 || !blob.wrap || !blob.wrapIv) {
    const data = await decryptWithKey<T>(blob, kek)
    return { data, key: kek }
  }
  const dekBytes = await decryptBytes({ iv: blob.wrapIv, data: blob.wrap }, kek)
  const dek = await importDek(dekBytes)
  const data = await decryptWithKey<T>(blob, dek)
  return { data, key: dek, dekBytes }
}

export async function persistWithKey(data: unknown, key: CryptoKey, blob: EncryptedBlob): Promise<EncryptedBlob> {
  const { iv, data: cipher } = await encryptWithKey(data, key)
  return { ...blob, iv, data: cipher }
}

export function isEncryptedBlob(value: unknown): value is EncryptedBlob {
  if (!value || typeof value !== 'object') return false
  const v = value as EncryptedBlob
  return (v.v === 1 || v.v === 2) && v.kdf === 'PBKDF2-SHA256' && typeof v.salt === 'string' && typeof v.data === 'string'
}
