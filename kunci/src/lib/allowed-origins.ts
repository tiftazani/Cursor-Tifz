export const DEFAULT_CLOUD_URL = 'https://kunci.tiftazani-cuciin.workers.dev'

/**
 * The unpacked Kunci extension. Its id is fixed by the `key` in manifest.json, so
 * the id is stable across reloads and machines.
 *
 * The worker used to trust a `Kunci-local/` User-Agent instead of this list. A
 * User-Agent is a header the caller writes, so any page could claim it and skip
 * the origin check; the extension's own origin is not forgeable from a web page.
 */
export const EXTENSION_ID = 'djiblgfjmjhjebgacdljbdoibbancniad'

export const EXTENSION_ORIGINS: readonly string[] = [`chrome-extension://${EXTENSION_ID}`]

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
    if (EXTENSION_ORIGINS.includes(origin)) return true
    if (LOCAL_APP_ORIGINS.includes(origin)) return true
    if (o.protocol === 'http:' && (o.hostname === '127.0.0.1' || o.hostname === 'localhost' || o.hostname === '[::1]')) {
      return true
    }
    return o.host === new URL(DEFAULT_CLOUD_URL).host
  } catch {
    return false
  }
}
