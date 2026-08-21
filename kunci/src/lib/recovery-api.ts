import { DAEMON_URL, RECOVERY_EMAIL } from './account'
import { b64ToBytes, bytesToB64 } from './encoding'

export { RECOVERY_EMAIL, DAEMON_URL }

function base(url?: string): string {
  const raw = (url && url.trim()) || DAEMON_URL
  return raw.replace(/\/$/, '')
}

export async function registerRecovery(dekBytes: Uint8Array, daemonUrl?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${base(daemonUrl)}/api/recovery/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dek: bytesToB64(dekBytes), email: RECOVERY_EMAIL }),
    })
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
    if (!res.ok || !body.ok) return { ok: false, error: body.error || `HTTP ${res.status}` }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Layanan Kunci belum jalan. Jalankan npm run install-service.' }
  }
}

export async function requestPasswordReset(daemonUrl?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${base(daemonUrl)}/api/recovery/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: RECOVERY_EMAIL }),
    })
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
    if (!res.ok || !body.ok) return { ok: false, error: body.error || `HTTP ${res.status}` }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Layanan Kunci belum jalan. Tutup terminal dev, lalu npm run install-service.' }
  }
}

export async function fetchResetDek(code: string, daemonUrl?: string): Promise<Uint8Array> {
  const res = await fetch(`${base(daemonUrl)}/api/recovery/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: RECOVERY_EMAIL, code: code.trim() }),
  })
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; dek?: string; error?: string }
  if (!res.ok || !body.ok || !body.dek) throw new Error(body.error || 'Kode salah atau kedaluwarsa')
  return b64ToBytes(body.dek)
}

export async function localToken(daemonUrl?: string): Promise<string | null> {
  try {
    const res = await fetch(`${base(daemonUrl)}/api/local-token`)
    if (!res.ok) return null
    const body = (await res.json()) as { token?: string }
    return body.token ?? null
  } catch {
    return null
  }
}
