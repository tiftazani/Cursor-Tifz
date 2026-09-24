export function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
    if (!url.hostname) return null
    return url.toString()
  } catch {
    return null
  }
}

export function hostFromUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  // A bare string is only a host if it has no spaces, no percent-encoding, and no
  // "@". Without the "@" check an entry NAMED after an account
  // ("tiftazani@gmail.com") parses as host "gmail.com", which then links every such
  // entry to every other one and buries the summary in a single giant cluster.
  const hasScheme = trimmed.includes('://')
  if (!hasScheme && (trimmed.includes(' ') || trimmed.includes('@') || /%[0-9a-f]{2}/i.test(trimmed))) return null
  try {
    const url = new URL(hasScheme ? trimmed : `https://${trimmed}`)
    return url.hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return null
  }
}

/**
 * The URL path a login was saved from: which prompt of a site it belongs to.
 * One host can ask for a password in more than one place (site login, then a
 * transfer or payment PIN); those are separate credentials for the same site.
 */
export function layerFromUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
    return url.pathname.replace(/\/+$/, '').toLowerCase()
  } catch {
    return ''
  }
}

export function domainsMatch(entryUrl: string, pageUrl: string): boolean {
  const a = hostFromUrl(entryUrl)
  const b = hostFromUrl(pageUrl)
  if (!a || !b) return false
  if (a === b) return true
  const shorter = a.length <= b.length ? a : b
  const longer = shorter === a ? b : a
  // A bare label ("com", "co", "io") is not a site; only a dotted name may be a suffix.
  if (!shorter.includes('.')) return false
  return longer.endsWith(`.${shorter}`)
}

/** An entry name may stand in for a host only as a whole domain label. */
export function nameMatchesHost(name: string, host: string): boolean {
  if (!name || !host) return false
  // A name holding an account ("tiftazani@gmail.com") is an account, not a site
  // label. Without this, "gmail.com" leaks out of the address itself and the entry
  // is offered on gmail.com wherever it is opened.
  if (name.includes('@')) return false
  if (name.includes(host)) return true
  const token = name.replace(/\s+/g, '')
  if (token.length < 4) return false
  return host.split('.').includes(token)
}

export function entryMatchesPage(
  entry: { url?: string; urls?: string[]; name?: string; appName?: string },
  pageUrl: string,
): boolean {
  const candidates = [entry.url, ...(entry.urls ?? [])].filter(Boolean) as string[]
  if (candidates.some((u) => domainsMatch(u, pageUrl))) return true
  const host = hostFromUrl(pageUrl)
  if (!host) return false
  const name = (entry.name ?? '').toLowerCase()
  const app = (entry.appName ?? '').toLowerCase()
  return nameMatchesHost(name, host) || nameMatchesHost(app, host)
}

export function appNameGuess(appName: string, haystack: string): boolean {
  const a = appName.trim().toLowerCase()
  const b = haystack.trim().toLowerCase()
  if (!a || !b) return false
  return a === b || b.includes(a) || a.includes(b)
}
