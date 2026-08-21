import { isEncryptedBlob } from './crypto'
import type { EncryptedBlob } from '../types'
import { RECOVERY_EMAIL } from './account'
import { DEFAULT_CLOUD_URL } from './allowed-origins'
import { isNetlifyAccessGate, NETLIFY_PRIVATE_SITE_HELP } from './netlify-gate'

const TOKEN_KEY = 'kunci_cloud_token'

export function isPublicHost(): boolean {
  const host = window.location.hostname
  return host !== 'localhost' && host !== '127.0.0.1' && host !== '[::1]'
}

export function cloudOrigin(): string {
  return ''
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
  const method = (init.method || 'GET').toUpperCase()
  const hasBody = init.body != null && method !== 'GET' && method !== 'HEAD'
  if (hasBody && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(`${cloudOrigin()}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  })
}

export async function sessionStatus(): Promise<{ signedIn: boolean; email?: string; configured?: boolean }> {
  const urls = isPublicHost()
    ? ['/api/session']
    : ['/api/session', `${DEFAULT_CLOUD_URL.replace(/\/$/, '')}/api/session`]

  for (const url of urls) {
    try {
      const ping = await fetch(url, {
        method: 'GET',
        credentials: url.startsWith('/') ? 'include' : 'omit',
      })
      if (ping.status !== 401 && !ping.ok) continue
      const token = readToken()
      if (token) {
        const authed = await fetch(url, {
          method: 'GET',
          credentials: 'omit',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (authed.ok) {
          const body = (await authed.json().catch(() => ({}))) as { email?: string }
          if (body.email) return { signedIn: true, email: body.email, configured: true }
        }
      }
      if (ping.ok) {
        const body = (await ping.json().catch(() => ({}))) as { email?: string }
        if (body.email) return { signedIn: true, email: body.email, configured: true }
      }
      return { signedIn: false, configured: true }
    } catch {
      /* try next URL */
    }
  }
  return { signedIn: false, configured: false }
}

function parseApiError(text: string, status: number, fallback: string): string {
  try {
    const body = JSON.parse(text) as { error?: string }
    if (body.error) return body.error
  } catch {
    /* not json */
  }
  if (isNetlifyAccessGate(status, text)) return NETLIFY_PRIVATE_SITE_HELP
  if (status === 404) return 'API cloud tidak ditemukan. Tunggu deploy Netlify, lalu coba lagi.'
  if (status === 429) return 'Terlalu banyak permintaan. Coba beberapa menit lagi.'
  return `${fallback} (HTTP ${status})`
}

export async function requestOtp(): Promise<void> {
  const res = await api('/api/auth/otp', { method: 'POST', body: JSON.stringify({ email: RECOVERY_EMAIL }) })
  const text = await res.text()
  if (!res.ok) throw new Error(parseApiError(text, res.status, 'Gagal mengirim kode masuk'))
}

export async function verifyOtp(code: string): Promise<void> {
  const res = await api('/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ email: RECOVERY_EMAIL, code: code.trim() }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(parseApiError(text, res.status, 'Kode salah'))
  const body = (() => {
    try {
      return JSON.parse(text) as { token?: string }
    } catch {
      return {} as { token?: string }
    }
  })()
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
