import { describe, expect, it } from 'vitest'
import {
  findDuplicateClusters,
  maskAccount,
  mergeEntriesInto,
  relatedDuplicate,
} from '../src/lib/duplicates'
import { clampSplit, parseSplit } from '../src/lib/split'
import type { Entry } from '../src/types'

function login(id: string, extra: Partial<Entry> = {}): Entry {
  return {
    id,
    type: 'login',
    name: extra.name ?? id,
    username: extra.username,
    password: extra.password,
    url: extra.url,
    urls: extra.urls ?? [],
    tags: extra.tags ?? [],
    favorite: extra.favorite ?? false,
    customFields: extra.customFields ?? [],
    history: extra.history ?? [],
    createdAt: extra.createdAt ?? 1,
    updatedAt: extra.updatedAt ?? 1,
    ...extra,
  }
}

describe('duplicate clusters', () => {
  it('groups www and bare host as the same site', () => {
    const a = login('1', { name: 'agoda.com', url: 'https://agoda.com', username: 'a@x.com', password: 'p' })
    const b = login('2', {
      name: 'www.agoda.com',
      url: 'https://www.agoda.com/login',
      username: 'a@x.com',
      password: 'p',
    })
    expect(relatedDuplicate(a, b)).toBe('same-site')
    const clusters = findDuplicateClusters([a, b])
    expect(clusters).toHaveLength(1)
    expect(clusters[0].memberIds.sort()).toEqual(['1', '2'])
    expect(clusters[0].suggestion).toBe('merge')
  })

  it('does not merge two accounts on the same site', () => {
    const a = login('1', { url: 'https://gmail.com', username: 'one@x.com', password: 'a' })
    const b = login('2', { url: 'https://gmail.com', username: 'two@x.com', password: 'b' })
    expect(relatedDuplicate(a, b)).toBeNull()
    expect(findDuplicateClusters([a, b])).toHaveLength(0)
  })

  it('flags password conflict and still clusters', () => {
    const a = login('1', { url: 'https://agoda.com', username: 'same', password: 'old', updatedAt: 1 })
    const b = login('2', { url: 'https://www.agoda.com', username: 'same', password: 'new', updatedAt: 2 })
    const [cluster] = findDuplicateClusters([a, b])
    expect(cluster.passwordConflict).toBe(true)
    expect(cluster.suggestion).toBe('delete')
    expect(cluster.keepId).toBe('2')
  })

  it('merges urls and keeps the chosen row', () => {
    const keep = login('keep', {
      name: 'Agoda',
      url: 'https://agoda.com',
      username: 'a@x.com',
      password: 'secret',
      urls: [],
    })
    const extra = login('drop', {
      name: 'www.agoda.com',
      url: 'https://www.agoda.com',
      username: '',
      password: '',
      notes: 'promo',
    })
    const merged = mergeEntriesInto(keep, [extra], 99)
    expect(merged.id).toBe('keep')
    expect(merged.urls).toEqual(expect.arrayContaining(['https://agoda.com', 'https://www.agoda.com']))
    expect(merged.notes).toBe('promo')
    expect(merged.username).toBe('a@x.com')
    expect(merged.password).toBe('secret')
  })

  it('masks usernames', () => {
    expect(maskAccount('tiftazani@gmail.com')).toBe('t•••@gmail.com')
    expect(maskAccount('ab')).toBe('•••')
  })
})

describe('split widths', () => {
  it('clamps and fills defaults', () => {
    expect(clampSplit(10, 168, 360)).toBe(168)
    expect(clampSplit(900, 240, 560)).toBe(560)
    expect(parseSplit({ sidebar: 200, list: 400 })).toEqual({ sidebar: 200, list: 400 })
    expect(parseSplit(null).sidebar).toBeGreaterThan(100)
  })
})
