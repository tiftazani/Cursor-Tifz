import { isEncryptedBlob } from './crypto'
import type { EncryptedBlob } from '../types'
import { RECOVERY_EMAIL } from './account'

export function isPublicHost(): boolean {
  const host = window.location.hostname
  return host !== 'localhost' && host !== '127.0.0.1' && host !== '[::1]'
}

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(path, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
}

export async function sessionStatus(): Promise<{ signedIn: boolean; email?: string; configured?: boolean }> {
  try {
    const res = await api('/api/session')
    if (res.status === 401) return { signedIn: false, configured: true }
    if (!res.ok) return { signedIn: false, configured: false }
    const body = (await res.json()) as { email?: string }
    return { signedIn: true, email: body.email, configured: true }
  } catch {
    return { signedIn: false, configured: false }
  }
}

export async function requestOtp(): Promise<void> {
  const res = await api('/api/auth/otp', { method: 'POST', body: JSON.stringify({ email: RECOVERY_EMAIL }) })
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new Error(body.error || 'Gagal mengirim kode masuk')
}

export async function verifyOtp(code: string): Promise<void> {
  const res = await api('/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ email: RECOVERY_EMAIL, code: code.trim() }),
  })
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new Error(body.error || 'Kode salah')
}

export async function logoutSession(): Promise<void> {
  await api('/api/auth/logout', { method: 'POST', body: '{}' }).catch(() => undefined)
}

export async function cloudGetVault(): Promise<EncryptedBlob | null> {
  if (!isPublicHost()) return null
  try {
    const res = await api('/api/vault')
    if (res.status === 401 || res.status === 404) return null
    if (!res.ok) return null
    const body = (await res.json()) as { blob?: unknown }
    if (!isEncryptedBlob(body.blob)) return null
    return body.blob
  } catch {
    return null
  }
}

export async function cloudPutVault(blob: EncryptedBlob): Promise<void> {
  if (!isPublicHost()) return
  const res = await api('/api/vault', { method: 'PUT', body: JSON.stringify({ blob }) })
  if (res.status === 401) throw new Error('Sesi publik habis. Masuk lagi dengan kode email.')
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || 'Gagal sinkron ke cloud')
  }
}

export async function emailRecoveryKey(recoveryKey: string): Promise<boolean> {
  const res = await api('/api/mail/recovery', {
    method: 'POST',
    body: JSON.stringify({ recoveryKey }),
  })
  return res.ok
}
