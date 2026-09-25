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

/**
 * Whether a url is an Android app login, which Chrome's Android export writes as
 *   android://<credential>@<package>/
 * The credential is base64, so the whole url is never a usable label, and the
 * row is not a website: it cannot be autofilled or opened. Dropped everywhere.
 */
export function isAndroidAppUrl(raw: string): boolean {
  return /^android:/i.test((raw || '').trim())
}

export function domainsMatch(a: string, b: string): boolean {
  const ha = hostFromUrl(a)
  const hb = hostFromUrl(b)
  if (!ha || !hb) return false
  // A login saved over https must not be filled into the same host over plain http:
  // the password would go out unencrypted on submit. Only refuse when we can tell
  // the saved side was secure and the page is not; a bare "example.com" (no scheme)
  // carries no such promise and still matches.
  if (isSecureUrl(a) && isInsecureUrl(b)) return false
  if (ha === hb) return true
  const shorter = ha.length <= hb.length ? ha : hb
  const longer = shorter === ha ? hb : ha
  // A bare label ("com", "co", "io") is not a site; only a dotted name may be a suffix.
  if (!shorter.includes('.')) return false
  return longer.endsWith(`.${shorter}`)
}

function isSecureUrl(raw: string): boolean {
  return /^https:\/\//i.test(String(raw ?? '').trim())
}

function isInsecureUrl(raw: string): boolean {
  return /^http:\/\//i.test(String(raw ?? '').trim())
}

/**
 * An entry name may stand in for a host only as a whole domain label.
 *
 * `name.includes(host)` looked harmless and was not: an entry named `notgmail.com`
 * matched `gmail.com` because the page host is a substring of the name, so the popup
 * offered the wrong site's login on gmail.com. The host direction leaked too:
 * `nameMatchesHost("gmail.com.evil.example", "gmail.com")` was true.
 *
 * A name is a label or a full domain, never a fragment:
 *   "gmail"        matches gmail.com, mail.gmail.com
 *   "mail.google"  matches mail.google.com
 *   "gmail.com"    matches gmail.com, mail.gmail.com
 * and nothing else.
 */
/**
 * The label a host actually owns: the site name in front of its public suffix.
 *
 * `app.slack.com` -> "slack", `bank.com.au` -> "bank", `gmail.evil.com` -> "evil".
 */
export function siteLabel(host: string): string {
  const parts = host.split('.')
  if (parts.length <= 2) return parts[0] ?? ''
  const last = parts[parts.length - 1] ?? ''
  const second = parts[parts.length - 2] ?? ''
  // A country-code second level ("co.uk", "com.au", "co.id") pushes the site label
  // one position further left.
  if (last.length === 2 && second.length <= 3) return parts[parts.length - 3] ?? ''
  return second
}

export function nameMatchesHost(name: string, host: string): boolean {
  if (!name || !host) return false
  // A name holding an account ("tiftazani@gmail.com") is an account, not a site
  // label. Without this, "gmail.com" leaks out of the address itself and the entry
  // is offered on gmail.com wherever it is opened.
  if (name.includes('@')) return false
  const token = name.replace(/\s+/g, '').replace(/^www\./, '')
  if (!token) return false
  if (token === host) return true
  // The name as a domain suffix of the host: gmail.com -> mail.gmail.com
  if (token.includes('.') && host.endsWith(`.${token}`)) return true
  // A bare service name ("gmail", "slack") stands in for the site it names, and only
  // for that site: the label the host actually owns. The old any-label rule accepted
  // "gmail" on gmail.evil.com, because the host split to ["gmail","evil","com"], so an
  // attacker's subdomain got the real password autofilled with no interaction.
  return siteLabel(host) === token
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
