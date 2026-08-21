import { DAEMON_URL, RECOVERY_EMAIL } from './account'

export { RECOVERY_EMAIL, DAEMON_URL }

function base(url?: string): string {
  const raw = (url && url.trim()) || DAEMON_URL
  return raw.replace(/\/$/, '')
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
