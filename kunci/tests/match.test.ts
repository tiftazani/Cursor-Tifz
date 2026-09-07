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
})
