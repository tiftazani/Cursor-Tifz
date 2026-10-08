import { isPublicSuffix, siteLabel } from './site'

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

// Port is part of a site's identity on loopback. `127.0.0.1:5178` (some other
// local app) and `127.0.0.1:8780` (Kunci itself) are two different applications
// running on one machine, so a login saved for one must not be offered on the
// other. Everywhere else the port is ignored, as before.
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

function hostKey(url: URL): string {
  const host = url.hostname.replace(/^www\./i, '').toLowerCase()
  // URL already drops the default port, so ":80"/":443" never shows up here.
  if (LOOPBACK_HOSTS.has(host) && url.port) return `${host}:${url.port}`
  return host
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
    return hostKey(url)
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
 * A site that asks for a shared password on every entry, then a personal username
 * and password. One vault entry cannot carry two passwords, so what the user needs
 * from such a site is a readable label: "which company code is this login for".
 *
 * The identifier is true only when the evidence is strong: a password box whose own
 * text says organisation/company/workspace, or a field the page itself marked with
 * autocomplete="organization" that is NOT the username. A by-password pair alone is
 * never enough, because plenty of ordinary logins quietly collect a company name.
 */
// A word boundary is not usable on field names: "_" is a word character, so
// /\bshared\b/ does NOT match "shared_password", and [ _-] runs like "company_code"
// are exactly how these boxes are named. Split on a non-alphanumeric edge instead,
// but keep the edge itself: a run inside another word ("someadmin") still must not
// match, while "company_code" and "kode perusahaan" must.
// Chrome 153 gets the same answer from a lookbehind; the older form is kept because
// this file also runs where lookbehind is missing.
const EDGE_START = '(^|[^A-Za-z0-9])'
const EDGE_END = '($|[^A-Za-z0-9])'
const EDGE_START_G = '([^A-Za-z0-9])'
const TENANT_FIELD_HINT = new RegExp(
  `${EDGE_START}(organization|organisation|company|tenant|workspace|team[ _-]?(code|id|name)|company[ _-]?(code|id)|kode[ _-]?(perusahaan|organisasi|tenant)|nama[ _-]?(perusahaan|organisasi)|perusahaan|organisasi)${EDGE_END}`,
  'i',
)
const TENANT_PASSWORD_HINT = new RegExp(
  `${EDGE_START_G}(shared|company|organisation|organization|tenant|org|group|team|master|parent|admin)${EDGE_END}`,
  'i',
)

export type TenantField = {
  name?: string
  id?: string
  autocomplete?: string
  placeholder?: string
  ariaLabel?: string
  label?: string
  type?: string
  tag?: string
}

/**
 * Everything a person can read on or beside the box. The label element is included
 * because plenty of forms label by `<label>Kode perusahaan</label>` and leave the
 * input itself anonymous, which is exactly how the shared-password stage is built.
 */
function fieldText(field: TenantField): string {
  return `${field.name || ''} ${field.id || ''} ${field.autocomplete || ''} ${field.placeholder || ''} ${field.ariaLabel || ''} ${field.label || ''}`
}

/**
 * The company box of a two-password form, or null.
 *
 * Two password boxes in one form is not normal, and when it happens the second
 * secret is almost always something else: a PIN, a confirmation box, a new password.
 * A field only counts as the company when its own text says so, and never when that
 * field is the username.
 */
export function tenantField(
  form: { fields?: TenantField[] },
  usernameField?: TenantField | null,
): TenantField | null {
  const fields = (form?.fields || []).filter((f) => f && f.tag !== 'select')
  const passwordFields = fields.filter((f) => (f.type || '').toLowerCase() === 'password')
  if (passwordFields.length < 2) return null
  const strong = passwordFields.some((f) => TENANT_PASSWORD_HINT.test(fieldText(f)))
  const named = fields.filter(
    (f) =>
      (f.type || 'text').toLowerCase() !== 'password' &&
      !/one-time-code/i.test(f.autocomplete || '') &&
      TENANT_FIELD_HINT.test(fieldText(f)),
  )
  if (!named.length) return null
  // When the password box itself says the password is shared, the company box may be
  // the same element the caller thinks is the username: the real site asks for the
  // company code first, and only then for a personal username.
  if (!strong) return named.find((f) => f !== usernameField) || null
  return named.find((f) => f !== usernameField) || named[0]!
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
  if (!longer.endsWith(`.${shorter}`)) return false
  // One host ends with the other, but that only means the same site when the shorter
  // one is a real site rather than a shared suffix. `surge.sh` gives every customer a
  // name under it, so `pelindo-kpi-monitoring.surge.sh` is somebody else's page and the
  // login saved for `surge.sh` must not be offered there. Same for github.io, netlify.app,
  // s3.amazonaws.com and every other public suffix.
  return !isPublicSuffix(shorter)
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
 * `siteLabel` itself lives in extension/site.js, backed by the real Public Suffix List,
 * because reading the last two labels got shared hosts wrong: it called
 * `pelindo-kpi-monitoring.surge.sh` a subdomain of `surge.sh`.
 */
export { siteLabel }

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
  //
  // Only when the name is a real site. A name that is itself a public suffix
  // ("surge.sh", "github.io") covers every customer's name beneath it, so accepting it
  // would offer that one entry on any of their pages: exactly the bug this file is
  // fixing, reached through the name instead of the URL.
  if (token.includes('.') && !isPublicSuffix(token) && host.endsWith(`.${token}`)) return true
  // A bare service name ("gmail", "slack") stands in for the site it names, and only
  // for that site: the label the host actually owns. The old any-label rule accepted
  // "gmail" on gmail.evil.com, because the host split to ["gmail","evil","com"], so an
  // attacker's subdomain got the real password autofilled with no interaction.
  //
  // siteLabel is what keeps a shared host honest here too. An entry named "Surge" is not
  // offered on `pelindo-kpi-monitoring.surge.sh`, because that host's own label is
  // `pelindo-kpi-monitoring`; the login still matches on `surge.sh` itself.
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
