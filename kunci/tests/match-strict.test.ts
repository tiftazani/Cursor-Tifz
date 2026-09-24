import { describe, expect, it } from 'vitest'
import { entryMatchesPage, domainsMatch, hostFromUrl } from '../src/lib/match'
// @ts-expect-error plain JS module shared with the extension
import { matchesForUrl } from '../extension/crypto.js'

// An entry must only be offered on the site it was saved for.
// Regression: fuzzy name fallback offered unrelated entries everywhere.
describe('entries are offered only on their own site', () => {
  it('does not match an entry by a name fragment inside an unrelated host', () => {
    // "tifta" is a substring of tiftazani-cuciin.workers.dev
    expect(entryMatchesPage({ name: 'tifta' }, 'https://tiftazani-cuciin.workers.dev')).toBe(false)
    expect(matchesForUrl([{ id: '1', name: 'tifta' }], 'https://tiftazani-cuciin.workers.dev')).toHaveLength(0)
  })

  it('does not match a saved URL against an unrelated page that merely ends with it', () => {
    expect(domainsMatch('https://com', 'https://accounts.google.com')).toBe(false)
    expect(domainsMatch('https://co', 'https://google.co.uk')).toBe(false)
  })

  it('still matches the site it was saved for, subdomains included', () => {
    expect(entryMatchesPage({ url: 'https://github.com/login' }, 'https://github.com/session')).toBe(true)
    expect(entryMatchesPage({ url: 'https://google.com' }, 'https://accounts.google.com')).toBe(true)
    expect(matchesForUrl([{ id: '1', type: 'login', url: 'https://github.com' }], 'https://github.com/login')).toHaveLength(1)
  })

  it('never offers anything on an empty or unparsable page URL', () => {
    expect(hostFromUrl('')).toBeNull()
    expect(matchesForUrl([{ id: '1', type: 'login', name: 'Gmail', url: 'https://gmail.com' }], '')).toHaveLength(0)
  })
})
