import { isEncryptedBlob } from './crypto'
import type { EncryptedBlob } from '../types'
import { RECOVERY_EMAIL } from './account'
import { DEFAULT_CLOUD_URL } from './allowed-origins'

const TOKEN_KEY = 'kunci_cloud_token'

export function isPublicHost(): boolean {
  const host = window.location.hostname
  return host !== 'localhost' && host !== '127.0.0.1' && host !== '[::1]'
}

export function cloudOrigin(): string {
  if (isPublicHost()) return ''
  return DEFAULT_CLOUD_URL.replace(/\/$/, '')
}

function readToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function saveCloudToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token)
}

export function clearCloudToken(): void {
  window.localStorage.removeItem(TOKEN_KEY)
}

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const token = readToken()
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(`${cloudOrigin()}${path}`, {
    ...init,
    credentials: 'include',
    headers,
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
  const body = (await res.json().catch(() => ({}))) as { error?: string; token?: string }
  if (!res.ok) throw new Error(body.error || 'Kode salah')
  if (body.token) saveCloudToken(body.token)
}

export async function logoutSession(): Promise<void> {
  await api('/api/auth/logout', { method: 'POST', body: '{}' }).catch(() => undefined)
  clearCloudToken()
}

export async function cloudGetVault(): Promise<EncryptedBlob | null> {
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
  const res = await api('/api/vault', { method: 'PUT', body: JSON.stringify({ blob }) })
  if (res.status === 401) throw new Error('Sesi cloud habis. Masuk lagi dengan kode email.')
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
