import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isPublicSuffix, registrableDomain, siteLabel } from '../src/lib/site'
import { domainsMatch, entryMatchesPage, nameMatchesHost } from '../src/lib/match'
import { matchesForUrl } from '../extension/crypto.js'

// A page on a shared host belongs to ONE customer of that host. The old rule took the
// last two labels of a hostname and called that the site, so every customer's page under
// `surge.sh` (or github.io, netlify.app, s3.amazonaws.com, ...) looked like a subdomain
// of the host itself, and the login saved for the host was offered on all of them.
// Reported from a real vault: on `pelindo-kpi-monitoring.surge.sh` the bar offered both
// the site's own login AND an entry named "Surge".
describe('shared hosts are not one site', () => {
  const page = 'https://pelindo-kpi-monitoring.surge.sh/'

  it('keeps the host’s own login', () => {
    expect(matchesForUrl([{ name: 'Pelindo-kpi-monitoring', url: page }], page)).toHaveLength(1)
  })

  it('drops an entry saved for the hosting service itself', () => {
    // The reported bug, through the URL: the entry for surge.sh must not answer here.
    expect(domainsMatch('https://surge.sh/', page)).toBe(false)
    const entries = [
      { name: 'Pelindo-kpi-monitoring', url: page },
      { name: 'Surge', url: 'https://surge.sh/' },
    ]
    expect(matchesForUrl(entries, page).map((e: { name: string }) => e.name)).toEqual([
      'Pelindo-kpi-monitoring',
    ])
  })

  it('drops an entry NAMED after the hosting service', () => {
    // Same bug through the name path: an entry named "Surge" with no URL.
    expect(matchesForUrl([{ name: 'Surge' }], page)).toHaveLength(0)
    expect(nameMatchesHost('surge', 'pelindo-kpi-monitoring.surge.sh')).toBe(false)
  })

  it('drops an entry whose NAME is the shared suffix as a domain', () => {
    // And through the name-as-domain path: a name of "surge.sh" is the suffix itself.
    expect(nameMatchesHost('surge.sh', 'pelindo-kpi-monitoring.surge.sh')).toBe(false)
  })

  it('still matches on the hosting service’s own page', () => {
    // The guard must not make those entries unreachable everywhere: on surge.sh itself
    // the entry named "Surge" is exactly the right answer.
    expect(matchesForUrl([{ name: 'Surge' }], 'https://surge.sh/')).toHaveLength(1)
    expect(entryMatchesPage({ name: 'Surge' }, 'https://surge.sh/')).toBe(true)
  })

  it('covers the whole class, not just surge.sh', () => {
    // Every one of these pairs is (a public suffix, a customer's name under it). The
    // suffix is written out rather than computed, because it is not always two labels:
    // `amazonaws.com` is NOT a suffix, while `s3.amazonaws.com` is.
    const pairs: [string, string][] = [
      ['github.io', 'foo.github.io'],
      ['netlify.app', 'bar.netlify.app'],
      ['pages.dev', 'baz.pages.dev'],
      ['vercel.app', 'qux.vercel.app'],
      ['blogspot.com', 'myblog.blogspot.com'],
      ['s3.amazonaws.com', 'thing.s3.amazonaws.com'],
      ['herokuapp.com', 'app.herokuapp.com'],
      ['web.app', 'site.web.app'],
    ]
    for (const [service, host] of pairs) {
      expect(isPublicSuffix(service), `${service} should be a public suffix`).toBe(true)
      expect(domainsMatch(`https://${service}/`, `https://${host}/`), `${service} vs ${host}`).toBe(false)
      expect(matchesForUrl([{ name: 'service', url: `https://${service}/` }], `https://${host}/`)).toHaveLength(0)
    }
  })
})

describe('siteLabel reads the real public suffix list', () => {
  it('returns the label the host owns', () => {
    expect(siteLabel('app.slack.com')).toBe('slack')
    expect(siteLabel('slack.com')).toBe('slack')
    expect(siteLabel('bank.com.au')).toBe('bank')
    expect(siteLabel('gmail.evil.com')).toBe('evil')
    expect(siteLabel('mail.google.co.id')).toBe('google')
  })

  it('returns the customer’s own name on a shared host', () => {
    expect(siteLabel('pelindo-kpi-monitoring.surge.sh')).toBe('pelindo-kpi-monitoring')
    expect(siteLabel('tiftazani.github.io')).toBe('tiftazani')
  })

  it('still handles the country-code suffixes the old heuristic special-cased', () => {
    // "co.uk", "com.au", "co.id": a 2-letter country code behind a short second level.
    expect(siteLabel('bbc.co.uk')).toBe('bbc')
    expect(siteLabel('news.com.au')).toBe('news')
    expect(siteLabel('tokopedia.co.id')).toBe('tokopedia')
  })

  it('handles rules the old heuristic could not see', () => {
    // A two-label suffix whose second label is longer than three characters. The old
    // rule only looked for a short country code, so it read these as `s3` and `sapporo`.
    expect(siteLabel('foo.s3.amazonaws.com')).toBe('foo')
    expect(siteLabel('city.sapporo.jp')).toBe('city')
    expect(siteLabel('x.airline.aero')).toBe('x')
  })

  it('names the registrable domain, which is the whole site', () => {
    expect(registrableDomain('accounts.google.com')).toBe('google.com')
    expect(registrableDomain('google.com')).toBe('google.com')
    expect(registrableDomain('pelindo-kpi-monitoring.surge.sh')).toBe('pelindo-kpi-monitoring.surge.sh')
    expect(registrableDomain('surge.sh')).toBe('surge.sh')
  })

  it('knows a bare suffix from a site', () => {
    for (const suffix of ['com', 'co.uk', 'surge.sh', 'github.io', 's3.amazonaws.com', 'ck']) {
      expect(isPublicSuffix(suffix), suffix).toBe(true)
    }
    for (const site of ['google.com', 'surge.sh.evil.com', 'foo.github.io']) {
      expect(isPublicSuffix(site), site).toBe(false)
    }
  })

  it('never lets a single-label name change a match', () => {
    // A single label is its own suffix by the default rule, so `localhost` reads as one.
    // That is harmless because every caller needs a dot before it asks: a bare label is
    // refused as a site outright, and a name only stands in for a domain when it has one.
    expect(isPublicSuffix('localhost')).toBe(true)
    expect(domainsMatch('http://localhost:3000', 'http://localhost:3000')).toBe(true)
    expect(domainsMatch('http://localhost:3000', 'http://evil.localhost:3000')).toBe(false)
    expect(siteLabel('localhost')).toBe('localhost')
  })

  it('honours a wildcard rule and its exception', () => {
    // `*.ck` makes `foo.ck` a suffix, so a host under it is a customer of that suffix.
    expect(isPublicSuffix('foo.ck')).toBe(true)
    expect(siteLabel('bar.foo.ck')).toBe('bar')
    // `!www.ck` takes it back: www.ck is a real registrable name.
    expect(isPublicSuffix('www.ck')).toBe(false)
    expect(siteLabel('www.ck')).toBe('www')
  })

  it('converts IDN rules, because a browser reports punycode', () => {
    // The list spells the rule `公司.cn`; location.hostname says `xn--55qx5d.cn`.
    // Stored in the original script the rule could never match.
    expect(isPublicSuffix('xn--55qx5d.cn')).toBe(true)
    expect(siteLabel('foo.xn--55qx5d.cn')).toBe('foo')
  })

  it('never throws on junk', () => {
    for (const host of ['', '.', '..', 'localhost', 'not a host', '-', 'a..b']) {
      expect(() => siteLabel(host)).not.toThrow()
      expect(() => isPublicSuffix(host)).not.toThrow()
    }
  })
})

describe('sites that must keep matching after the fix', () => {
  it('keeps a site and its own subdomains together', () => {
    expect(domainsMatch('https://google.com', 'https://accounts.google.com')).toBe(true)
    expect(domainsMatch('https://mail.google.com', 'https://google.com')).toBe(true)
    expect(domainsMatch('https://github.com/login', 'https://github.com/session')).toBe(true)
    expect(domainsMatch('https://bank.com.au', 'https://secure.bank.com.au/login')).toBe(true)
  })

  it('still refuses an attacker’s subdomain', () => {
    expect(domainsMatch('https://google.com', 'https://google.evil.com')).toBe(false)
    expect(nameMatchesHost('google', 'google.evil.com')).toBe(false)
    expect(nameMatchesHost('gmail', 'gmail.evil.com')).toBe(false)
  })

  it('still refuses a bare label as a site', () => {
    expect(domainsMatch('https://com', 'https://accounts.google.com')).toBe(false)
    expect(domainsMatch('https://co', 'https://google.co.uk')).toBe(false)
  })

  it('still refuses plain http for an https-saved login', () => {
    expect(domainsMatch('https://example.com', 'http://example.com')).toBe(false)
    expect(domainsMatch('example.com', 'http://example.com')).toBe(true)
  })

  it('keeps two customers of the same host apart in both directions', () => {
    const a = 'https://alpha.github.io/'
    const b = 'https://beta.github.io/'
    expect(domainsMatch(a, b)).toBe(false)
    expect(matchesForUrl([{ name: 'alpha', url: a }], b)).toHaveLength(0)
    expect(matchesForUrl([{ name: 'alpha', url: a }], a)).toHaveLength(1)
  })
})

describe('the data the extension ships', () => {
  const file = join(__dirname, '..', 'extension', 'public-suffix.js')
  const source = readFileSync(file, 'utf8')

  it('is loaded as a module by the extension, not only by the app', () => {
    // popup.js and background.js import crypto.js, which imports site.js, which imports
    // this file. A plain-JS module is what the unpacked extension can load as-is.
    const site = readFileSync(join(__dirname, '..', 'extension', 'site.js'), 'utf8')
    expect(site).toContain("from './public-suffix.js'")
    const crypto = readFileSync(join(__dirname, '..', 'extension', 'crypto.js'), 'utf8')
    expect(crypto).toContain("from './site.js'")
  })

  it('carries the rules that matter, and says how old it is', () => {
    expect(source).toContain('export const PSL_RULES')
    expect(source).toMatch(/PSL_FETCHED = '\d{4}-\d{2}-\d{2}'/)
    // surge.sh and github.io are the two the bug report named.
    expect(source).toMatch(/^sh .*surge/m)
    expect(source).toMatch(/^io .*github/m)
  })
})
