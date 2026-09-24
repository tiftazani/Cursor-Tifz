import { describe, expect, it } from 'vitest'
import { searchEntries } from '../src/lib/search'
import type { Entry } from '../src/types'

const sample: Entry[] = [
  {
    id: '1',
    type: 'login',
    name: 'GitHub',
    username: 'tiftazani',
    url: 'https://github.com',
    urls: [],
    tags: ['kerja'],
    favorite: true,
    customFields: [],
    history: [],
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: '2',
    type: 'app',
    name: 'Mail',
    appName: 'Mail',
    username: 'tif@mac',
    urls: [],
    tags: [],
    favorite: false,
    customFields: [],
    history: [],
    createdAt: 1,
    updatedAt: 1,
  },
]

describe('search', () => {
  it('matches every token against name, username, url, and tags', () => {
    expect(searchEntries(sample, 'git tif').map((e) => e.id)).toEqual(['1'])
    expect(searchEntries(sample, 'kerja').map((e) => e.id)).toEqual(['1'])
    expect(searchEntries(sample, 'mail').map((e) => e.id)).toEqual(['2'])
    expect(searchEntries(sample, '')).toHaveLength(2)
  })

  it('hands back a copy so sorting cannot reorder the vault', () => {
    // The vault list sorts whatever searchEntries returns. Returning the vault's
    // own array meant every render sorted the saved data in place, and the new
    // order was then persisted.
    const result = searchEntries(sample, '')
    expect(result).not.toBe(sample)
    result.sort((a, b) => (a.id < b.id ? 1 : -1))
    expect(sample.map((e) => e.id)).toEqual(['1', '2'])
  })
})
