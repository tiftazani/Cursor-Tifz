export const DEFAULT_CLOUD_URL = 'https://kunci-tifta.netlify.app'

export const LOCAL_APP_ORIGINS: readonly string[] = [
  'http://127.0.0.1:8780',
  'http://localhost:8780',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
]

export function isAllowedKunciOrigin(origin: string, requestHost: string): boolean {
  try {
    const o = new URL(origin)
    if (o.host === requestHost) return true
    if (LOCAL_APP_ORIGINS.includes(origin)) return true
    return o.host === new URL(DEFAULT_CLOUD_URL).host
  } catch {
    return false
  }
}
