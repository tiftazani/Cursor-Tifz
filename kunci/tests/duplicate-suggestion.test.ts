import { describe, expect, it } from 'vitest'
import { findDuplicateClusters } from '../src/lib/duplicates'
import type { Entry } from '../src/types'

/**
 * The card pre-selects one entry per group, and the default used to be simply the
 * most recently edited one. That is not a quality signal: a row whose name is still
 * a raw url can be newer than the row beside it that carries the site name and the
 * account. The suggestion has to prefer the entry a person can recognise.
 */
function entry(over: Partial<Entry> & { id: string }): Entry {
  return {
    id: over.id,
    type: 'login',
    name: '',
    username: '',
    password: 'p1',
    updatedAt: 1000,
    createdAt: 1000,
    ...over,
  } as Entry
}

const keepOf = (entries: Entry[]) => findDuplicateClusters(entries)[0]?.keepId

describe('duplicate suggestion: which entry to keep', () => {
  it('keeps the row with a username over the nameless one, even when the nameless one is newer', () => {
    // The real pair: the shared-stage leftover has no account at all, while the saved
    // login carries the username. The nameless row is the newer one, which is exactly
    // why recency alone made the worse entry the recommendation.
    const nameless = entry({ id: 'a', url: 'https://talentradar-my.app', name: 'talentradar-my.app', updatedAt: 9000 })
    const named = entry({ id: 'b', url: 'https://talentradar-my.app', name: 'Talentradar-my', username: 'ti•••', updatedAt: 10 })
    expect(keepOf([nameless, named])).toBe('b')
  })

  it('keeps a readable name over a raw url, even when the raw url row is newer', () => {
    const raw = entry({ id: 'a', url: 'http://isg1.indosatm2.com', name: 'http://isg1.indosatm2.com', username: '0857', updatedAt: 9000 })
    const readable = entry({ id: 'b', url: 'https://isg1.indosatm2.com', name: 'isg1.indosatm2.com (085778886651)', username: '0857', updatedAt: 10 })
    expect(keepOf([raw, readable])).toBe('b')
  })

  it('keeps the row whose name is more than the bare host', () => {
    const bare = entry({ id: 'a', url: 'http://localhost:20128', name: 'localhost', username: 'At', updatedAt: 9000 })
    const full = entry({ id: 'b', url: 'http://localhost:20128', name: 'Localhost (admin)', username: 'At', updatedAt: 10 })
    expect(keepOf([bare, full])).toBe('b')
  })

  it('falls back to the most recently edited entry when both rows are equal in quality', () => {
    const older = entry({ id: 'a', url: 'https://a.example.com', name: 'a.example.com', username: 'u1', updatedAt: 10 })
    const newer = entry({ id: 'b', url: 'https://a.example.com', name: 'a.example.com', username: 'u1', updatedAt: 9000 })
    expect(keepOf([older, newer])).toBe('b')
  })

  it('prefers the row that still holds a password over an empty one', () => {
    const filled = entry({ id: 'a', url: 'https://b.example.com', name: 'b.example.com', username: 'u1', password: 'p1', updatedAt: 10 })
    const blank = entry({ id: 'b', url: 'https://b.example.com', name: 'b.example.com', username: 'u1', password: '', updatedAt: 9000 })
    expect(keepOf([filled, blank])).toBe('a')
  })

  it('never lets a company-only difference pass the same-account quality rule', () => {
    // Two logins for one site that differ by company are two logins, not a duplicate
    // pair, so there is nothing to choose between and no cluster at all.
    const one = entry({ id: 'a', url: 'https://talentradar-my.app', name: 'talentradar-my.app · PT Satu', username: 'ti', appName: 'PT Satu' })
    const two = entry({ id: 'b', url: 'https://talentradar-my.app', name: 'talentradar-my.app · PT Dua', username: 'ti', appName: 'PT Dua' })
    expect(findDuplicateClusters([one, two])).toHaveLength(0)
  })

  it('prefers the name without a www prefix, so the entry keeps matching its card title', () => {
    // Both rows are named after the site and both carry the account, so quality is
    // equal except for the prefix. Keeping `www.agoda.com` names the entry against the
    // `agoda.com` heading the card is showing.
    const bare = entry({ id: 'a', url: 'https://agoda.com', name: 'agoda.com', username: 'tif@example.com', updatedAt: 10 })
    const www = entry({ id: 'b', url: 'https://www.agoda.com', name: 'www.agoda.com', username: 'tif@example.com', updatedAt: 9000 })
    const clusters = findDuplicateClusters([bare, www])
    expect(clusters[0].title).toBe('agoda.com')
    expect(clusters[0].keepId).toBe('a')
  })
})
