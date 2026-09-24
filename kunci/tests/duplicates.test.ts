import { describe, expect, it } from 'vitest'
import {
  findDuplicateClusters,
  layerOf,
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

  it('keeps different subdomains of one brand apart', () => {
    // The old domain-family check put all 14 of these in one cluster.
    const rows = [
      login('g1', { url: 'https://accounts.google.com', username: 't@x.com', password: 'p1' }),
      login('g2', { url: 'https://accounts.google.com', username: 't@x.com', password: 'p2' }),
      login('g3', { url: 'https://myaccount.google.com', username: 't@x.com', password: 'p3' }),
      login('g4', { url: 'https://mail.google.com', username: 't@x.com', password: 'p4' }),
      login('sp', { url: 'https://accounts.spotify.com', username: 't@x.com', password: 'p5' }),
      login('sn', { url: 'https://my.account.sony.com', username: 't@x.com', password: 'p6' }),
      login('az', { url: 'https://www.amazon.com', username: 't@x.com', password: 'p7' }),
      login('dk', { url: 'https://www.dekkoo.com', username: 't@x.com', password: 'p8' }),
    ]
    const clusters = findDuplicateClusters(rows)
    expect(clusters).toHaveLength(1)
    expect(clusters[0].memberIds.sort()).toEqual(['g1', 'g2'])
    // No cluster may span two different hosts.
    for (const c of clusters) {
      expect(new Set(c.members.map((m) => m.host)).size, `cluster ${c.title}`).toBe(1)
    }
  })

  it('treats two accounts on one host as separate credentials', () => {
    const a = login('a', { url: 'https://agoda.com', username: 'one@x.com', password: 'p1' })
    const b = login('b', { url: 'https://www.agoda.com/en-gb/', username: 'two@x.com', password: 'p2' })
    expect(relatedDuplicate(a, b)).toBeNull()
    expect(findDuplicateClusters([a, b])).toHaveLength(0)
  })

  it('keeps a second password layer on the same host apart', () => {
    // One site, two layers: the site login and a payment PIN.
    const site = login('s', { url: 'https://bank.example.com/login', username: 'me', password: 'p1' })
    const pay = login('p', { url: 'https://bank.example.com/transfer/confirm', username: 'me', password: 'p2' })
    expect(relatedDuplicate(site, pay)).toBeNull()
    expect(findDuplicateClusters([site, pay])).toHaveLength(0)
    expect(layerOf(site)).toBe('/login')
    expect(layerOf(pay)).toBe('/transfer/confirm')
  })

  it('never clusters an OTP entry', () => {
    const otp = login('o', { name: 'OTP Google', url: 'https://accounts.google.com', username: 't@x.com', password: 'p' })
    const same = login('s', { name: 'Google OTP', url: 'https://accounts.google.com', username: 't@x.com', password: 'p' })
    expect(relatedDuplicate(otp, same)).toBeNull()
    expect(findDuplicateClusters([otp, same])).toHaveLength(0)
  })

  it('still clusters entries that carry no URL, using the site name', () => {
    const a = login('1', { name: 'agoda.com', username: 'me', password: 'p1' })
    const b = login('2', { name: 'agoda.com', username: 'me', password: 'p2' })
    const [cluster] = findDuplicateClusters([a, b])
    expect(cluster?.memberIds.sort()).toEqual(['1', '2'])
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
