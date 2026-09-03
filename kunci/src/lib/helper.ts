import { DAEMON_URL } from './account'
import { localToken } from './recovery-api'

export interface HelperStatus {
  ok: boolean
  platform?: string
  version?: string
  error?: string
  accessibility?: boolean
  ui?: boolean
}

export interface FillPayload {
  username?: string
  password?: string
  mode: 'login' | 'password'
  appName?: string
  waitMs?: number
}

function helperBase(baseUrl: string): string {
  return (baseUrl || DAEMON_URL).replace(/\/$/, '')
}

export async function pingHelper(baseUrl: string): Promise<HelperStatus> {
  const url = helperBase(baseUrl)
  try {
    const res = await fetch(`${url}/health`, { method: 'GET' })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    return (await res.json()) as HelperStatus
  } catch {
    return { ok: false, error: 'Helper Mac tidak terhubung' }
  }
}

export async function resolveHelperToken(baseUrl: string, stored: string): Promise<string> {
  if (stored) return stored
  return (await localToken(baseUrl)) || ''
}

export async function fillHelper(
  baseUrl: string,
  token: string,
  payload: FillPayload,
): Promise<{ ok: boolean; error?: string; method?: string; app?: string }> {
  const url = helperBase(baseUrl)
  const attempt = async (auth: string) => {
    if (!auth) {
      return { ok: false as const, error: 'Token helper kosong. Pastikan layanan Kunci jalan di Mac (npm run install-service).' }
    }
    try {
      const res = await fetch(`${url}/fill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Kunci-Token': auth,
        },
        body: JSON.stringify(payload),
      })
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; method?: string; app?: string }
      if (!res.ok || !body.ok) return { ok: false as const, error: body.error || `HTTP ${res.status}` }
      return { ok: true as const, method: body.method, app: body.app }
    } catch {
      return { ok: false as const, error: 'Layanan Kunci belum jalan. Di folder kunci jalankan npm run install-service.' }
    }
  }
  const first = await resolveHelperToken(baseUrl, token)
  const result = await attempt(first)
  if (result.ok || !/401|Token helper/.test(result.error || '')) return result
  const fresh = await localToken(baseUrl)
  if (!fresh || fresh === first) return result
  return attempt(fresh)
}

export async function frontmostApp(baseUrl: string): Promise<string | null> {
  const url = helperBase(baseUrl)
  try {
    const res = await fetch(`${url}/frontmost`)
    if (!res.ok) return null
    const body = (await res.json()) as { app?: string | null }
    return body.app || null
  } catch {
    return null
  }
}

export async function listHelperApps(
  baseUrl: string,
): Promise<{ apps: string[]; accessibility: boolean; platform?: string }> {
  const url = helperBase(baseUrl)
  try {
    const res = await fetch(`${url}/apps`)
    if (!res.ok) return { apps: [], accessibility: false }
    return (await res.json()) as { apps: string[]; accessibility: boolean; platform?: string }
  } catch {
    return { apps: [], accessibility: false }
  }
}
