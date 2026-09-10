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
  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
    return url.hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return null
  }
}

export function domainsMatch(entryUrl: string, pageUrl: string): boolean {
  const a = hostFromUrl(entryUrl)
  const b = hostFromUrl(pageUrl)
  if (!a || !b) return false
  if (a === b) return true
  return b.endsWith(`.${a}`) || a.endsWith(`.${b}`)
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
  return Boolean(host && (name.includes(host) || host.includes(name.replace(/\s+/g, '')) || app.includes(host)))
}

export function appNameGuess(appName: string, haystack: string): boolean {
  const a = appName.trim().toLowerCase()
  const b = haystack.trim().toLowerCase()
  if (!a || !b) return false
  return a === b || b.includes(a) || a.includes(b)
}
