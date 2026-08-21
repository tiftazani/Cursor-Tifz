export interface HelperStatus {
  ok: boolean
  platform?: string
  version?: string
  error?: string
}

export async function pingHelper(baseUrl: string): Promise<HelperStatus> {
  const url = baseUrl.replace(/\/$/, '')
  try {
    const res = await fetch(`${url}/health`, { method: 'GET' })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    return (await res.json()) as HelperStatus
  } catch {
    return { ok: false, error: 'Helper Mac tidak terhubung' }
  }
}

export async function fillHelper(
  baseUrl: string,
  token: string,
  payload: { username?: string; password?: string; mode: 'login' | 'password' },
): Promise<{ ok: boolean; error?: string }> {
  const url = baseUrl.replace(/\/$/, '')
  try {
    const res = await fetch(`${url}/fill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Kunci-Token': token,
      },
      body: JSON.stringify(payload),
    })
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
    if (!res.ok || !body.ok) return { ok: false, error: body.error || `HTTP ${res.status}` }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Tidak bisa menghubungi helper Mac. Jalankan npm run helper.' }
  }
}
