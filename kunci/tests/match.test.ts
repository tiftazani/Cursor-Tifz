import { describe, expect, it } from 'vitest'
import { domainsMatch, entryMatchesPage, hostFromUrl } from '../src/lib/match'

describe('url matching', () => {
  it('strips www and scheme', () => {
    expect(hostFromUrl('https://www.Netflix.com/login')).toBe('netflix.com')
    expect(hostFromUrl('netflix.com')).toBe('netflix.com')
  })

  it('matches a site and its subdomains', () => {
    expect(domainsMatch('https://google.com', 'https://accounts.google.com')).toBe(true)
    expect(domainsMatch('https://mail.google.com', 'https://google.com')).toBe(true)
    expect(domainsMatch('https://google.com', 'https://google.evil.com')).toBe(false)
  })

  it('matches saved logins to the current page', () => {
    expect(
      entryMatchesPage({ url: 'https://github.com/login', name: 'GitHub' }, 'https://github.com/session'),
    ).toBe(true)
    expect(entryMatchesPage({ name: 'slack', appName: 'Slack' }, 'https://app.slack.com')).toBe(true)
  })

  it('rejects free text that is not a hostname', () => {
    expect(hostFromUrl('PIN wifi')).toBeNull()
    expect(hostFromUrl('My Bank Login')).toBeNull()
    expect(hostFromUrl('pin%20wifi')).toBeNull()
    expect(hostFromUrl('  ')).toBeNull()
    expect(hostFromUrl('https://example.com/a b')).toBe('example.com')
  })

  it('does not read an account name as a host', () => {
    // Entry names often hold the account. Parsing that as "gmail.com" made every
    // such entry share a host, which collapsed the summary into one giant cluster.
    expect(hostFromUrl('tiftazani@gmail.com')).toBeNull()
    expect(hostFromUrl('a@b.com')).toBeNull()
    expect(hostFromUrl('https://accounts.google.com')).toBe('accounts.google.com')
  })

  it('does not offer an account-named entry on hosts inside the address', () => {
    const entry = { name: 'tiftazani@gmail.com', url: 'https://agoda.com' }
    expect(entryMatchesPage(entry, 'https://agoda.com')).toBe(true)
    expect(entryMatchesPage(entry, 'https://gmail.com')).toBe(false)
    expect(entryMatchesPage(entry, 'https://google.com')).toBe(false)
    // A real site name still stands in for its host when the URL is missing.
    expect(entryMatchesPage({ name: 'Agoda' }, 'https://www.agoda.com')).toBe(true)
  })
})
