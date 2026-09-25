export const DEFAULT_CLOUD_URL = 'https://kunci.tiftazani-cuciin.workers.dev'

/**
 * The unpacked Kunci extension.
 *
 * Chrome derives an unpacked extension's id from the absolute path of its folder,
 * so the id changes the moment the repo is cloned somewhere else. The value that
 * was here had 33 characters — one more than the 32 a browser can produce — so it
 * never matched anything and the daemon answered the extension's own health poll
 * with 403. Derived from `kunci/extension` next to this file:
 * sha256('/Users/tiftazani/Documents/Hermes-AI/Kunci/kunci/extension')[0..32].
 *
 * The worker used to trust a `Kunci-local/` User-Agent instead of this list. A
 * User-Agent is a header the caller writes, so any page could claim it and skip
 * the origin check; the extension's own origin is not forgeable from a web page.
 */
export const EXTENSION_ID = 'djiblgfjmhjebgacdljbdoibbancniad'

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
