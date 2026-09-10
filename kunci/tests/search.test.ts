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
})
