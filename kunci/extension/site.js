// Which part of a hostname is the site, and which part is a suffix anyone can register
// under. The rules come from extension/public-suffix.js (generated).
//
// Kunci has to get this right because the wrong answer offers one site's saved login on
// another site's page. Surge, GitHub Pages, Netlify, Vercel, S3 and a thousand others
// give every customer their own name under a shared suffix: `pelindo-kpi-monitoring.surge.sh`
// is a DIFFERENT site from `surge.sh`, even though one ends with the other. Reading the
// last two labels called them the same site.
import { PSL_RULES, PSL_WILDCARDS, PSL_EXCEPTIONS } from './public-suffix.js'

let rules = null
let wildcards = null
let exceptions = null

/**
 * Build the lookup sets once. The rules ship as one line per last label
 * (`sh botda com surge`) because that is far smaller than a list of full names.
 */
function load() {
  if (rules) return
  rules = new Set()
  for (const line of PSL_RULES.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const cut = trimmed.indexOf(' ')
    if (cut < 0) continue
    const tld = trimmed.slice(0, cut)
    for (const head of trimmed.slice(cut + 1).split(' ')) {
      if (head) rules.add(`${head}.${tld}`)
    }
  }
  wildcards = new Set(PSL_WILDCARDS.split(' ').filter(Boolean))
  exceptions = new Set(PSL_EXCEPTIONS.split(' ').filter(Boolean))
}

/**
 * How many labels at the end of `labels` are the public suffix.
 *
 * This is the Public Suffix List algorithm: the prevailing rule is the matching rule
 * with the most labels. A `*.` rule covers one label under its base, an `!` rule takes
 * one label back, and with no match at all the default `*` rule applies, which makes the
 * last label alone the suffix.
 */
function suffixLabels(labels) {
  load()
  let best = 1
  for (let i = 0; i < labels.length; i++) {
    const count = labels.length - i
    const candidate = labels.slice(i).join('.')
    // An exception is a name that is NOT a suffix even though a wildcard says so:
    // `!www.ck` keeps `www.ck` registrable, so the suffix there is only `ck`. The list
    // algorithm makes an exception the prevailing rule whenever it matches, beating the
    // wildcard it was written to correct, so this returns instead of competing.
    if (exceptions.has(candidate)) return count - 1
    // A `*.` rule has one label more than its base, and a rule only matches a domain
    // that has at least as many labels as the rule. `*.ck` therefore says `foo.ck` is a
    // suffix, but it says nothing about `ck` itself, which is a suffix by the default
    // rule below.
    if (wildcards.has(candidate) && count + 1 <= labels.length && count + 1 > best) best = count + 1
    if (rules.has(candidate) && count > best) best = count
  }
  return best
}

/**
 * The label the host actually owns: the site name in front of its public suffix.
 *
 * `app.slack.com` -> "slack", `bank.com.au` -> "bank", `gmail.evil.com` -> "evil",
 * `pelindo-kpi-monitoring.surge.sh` -> "pelindo-kpi-monitoring", `surge.sh` -> "surge".
 */
export function siteLabel(host) {
  const labels = String(host || '').split('.').filter(Boolean)
  if (!labels.length) return ''
  const index = labels.length - suffixLabels(labels) - 1
  // Nothing in front of the suffix means the host IS the suffix, or a bare name with no
  // dot: either way the first label is the best answer available.
  return index >= 0 ? labels[index] : labels[0]
}

/**
 * The whole site a host belongs to: its label plus its public suffix.
 *
 * `accounts.google.com` -> "google.com", `pelindo-kpi-monitoring.surge.sh` -> itself,
 * `surge.sh` -> itself. Two hosts are the same site exactly when these are equal.
 */
export function registrableDomain(host) {
  const labels = String(host || '').split('.').filter(Boolean)
  if (!labels.length) return ''
  const index = labels.length - suffixLabels(labels) - 1
  return index >= 0 ? labels.slice(index).join('.') : labels.join('.')
}

/**
 * Whether the whole host is a public suffix, so anyone can register a name under it.
 *
 * `surge.sh`, `github.io`, `co.uk`, `com` are suffixes. `google.com` and `foo.github.io`
 * are sites. A suffix is never a site someone saved a login for in the ordinary sense,
 * so it must not be treated as a parent of the names beneath it.
 */
export function isPublicSuffix(host) {
  const labels = String(host || '').split('.').filter(Boolean)
  if (!labels.length) return false
  return suffixLabels(labels) === labels.length
}
