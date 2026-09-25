import { describe, expect, it } from 'vitest'
import {
  DEAD_BEFORE_MS,
  canStartCheck,
  checkableEntries,
  checkableUrl,
  checkDisclosure,
  dayKey,
  deadLinkDetail,
  deadLinks,
  reasonFor,
  recordCheck,
  remainingCount,
  verdictFromProbe,
} from '../src/lib/dead-links'
import type { Entry } from '../src/types'

function entry(over: Partial<Entry> = {}): Entry {
  return {
    id: 'e1', type: 'login', name: 'Situs', password: 'x', urls: [], tags: [],
    history: [], createdAt: 0, updatedAt: 0, ...over,
  }
}

const DAY1 = new Date(2026, 8, 24, 10, 0, 0).getTime()
const DAY1_LATER = new Date(2026, 8, 24, 22, 0, 0).getTime()
const DAY2 = new Date(2026, 8, 25, 9, 0, 0).getTime()

describe('which address gets tested', () => {
  it('tests the host, so a deep link and its home page are one check', () => {
    expect(checkableUrl(entry({ url: 'https://example.com/login?next=/x' }))).toBe('example.com')
  })

  it('accepts a bare domain and adds the scheme', () => {
    expect(checkableUrl(entry({ url: 'example.com' }))).toBe('example.com')
  })

  it('prefers the entry url over the extra urls', () => {
    expect(checkableUrl(entry({ url: 'primary.com', urls: ['other.com'] }))).toBe('primary.com')
  })

  it('falls back to the first extra url', () => {
    expect(checkableUrl(entry({ url: undefined, urls: ['other.com'] }))).toBe('other.com')
  })

  it('skips entries with nothing to look up', () => {
    // An app entry, a note, or a login saved without an address cannot be tested, and
    // pretending otherwise would report a dead site for a working entry.
    expect(checkableUrl(entry({ url: undefined, type: 'note' }))).toBeNull()
    expect(checkableUrl(entry({ url: '   ' }))).toBeNull()
    expect(checkableUrl(entry({ url: 'not a url at all' }))).toBeNull()
    expect(checkableEntries([entry({ url: 'a.com' }), entry({ id: 'e2' })])).toHaveLength(1)
  })

  it('uses the local day, not the UTC day', () => {
    // Two checks either side of local midnight are two different days even when UTC
    // still calls it the same one.
    const lateNight = new Date(2026, 8, 24, 23, 30, 0).getTime()
    const earlyMorning = new Date(2026, 8, 25, 0, 30, 0).getTime()
    expect(dayKey(lateNight)).not.toBe(dayKey(earlyMorning))
    expect(dayKey(DAY1)).toBe(dayKey(DAY1_LATER))
  })
})

describe('reading a probe result', () => {
  it('calls a failure that never reached the network dead', () => {
    // 1 to 23 ms is what an unresolvable name looks like, measured in a real browser.
    expect(verdictFromProbe({ ms: 2, reportedAlive: false, timedOut: false })).toBe('dead')
    expect(verdictFromProbe({ ms: 23, reportedAlive: false, timedOut: false })).toBe('dead')
  })

  it('calls a slow failure alive, because a live site still took time to refuse', () => {
    // Every live host measured 78 to 1376 ms to fail. A site that answers at all still
    // has a name, which is the only question being asked here.
    expect(verdictFromProbe({ ms: 95, reportedAlive: false, timedOut: false })).toBe('alive')
    expect(verdictFromProbe({ ms: 1376, reportedAlive: false, timedOut: false })).toBe('alive')
  })

  it('calls anything that answered alive', () => {
    expect(verdictFromProbe({ ms: 5000, reportedAlive: true, timedOut: false })).toBe('alive')
  })

  it('treats a timeout as unknown, never as death', () => {
    // A site that is merely slow must not be condemned, however long it took.
    expect(verdictFromProbe({ ms: 10_000, reportedAlive: false, timedOut: true })).toBe('unclear')
    expect(reasonFor('unclear', true)).toBe('timeout')
  })

  it('keeps the threshold in the gap between the two measured groups', () => {
    // Above the worst dead case and below the fastest live case, with room on both
    // sides, so a slow machine does not start condemning live sites.
    expect(DEAD_BEFORE_MS).toBeGreaterThan(23)
    expect(DEAD_BEFORE_MS).toBeLessThan(78)
  })

  it('records no failure reason for a site that is alive', () => {
    expect(reasonFor('alive', false)).toBeUndefined()
    expect(reasonFor('dead', false)).toBe('dns')
  })
})

describe('gathering evidence across days', () => {
  it('does not call a site dead from a single bad day', () => {
    const rec = recordCheck(undefined, 'e1', 'gone.example', { url: 'gone.example', verdict: 'dead', reason: 'dns', at: DAY1 }, DAY1)
    expect(rec.deadDays).toBe(1)
    expect(deadLinks([entry({ url: 'gone.example' })], { e1: rec })).toHaveLength(0)
  })

  it('cannot reach the bar by retrying on the same day', () => {
    // The whole point of the day-gate: twenty retries in one afternoon are still one
    // day of evidence.
    let rec = recordCheck(undefined, 'e1', 'u', { url: 'u', verdict: 'dead', reason: 'dns', at: DAY1 }, DAY1)
    for (let i = 0; i < 20; i++) {
      rec = recordCheck(rec, 'e1', 'u', { url: 'u', verdict: 'dead', reason: 'dns', at: DAY1_LATER }, DAY1_LATER)
    }
    expect(rec.deadDays).toBe(1)
  })

  it('confirms a dead site once the same failure is seen on a second day', () => {
    let rec = recordCheck(undefined, 'e1', 'gone.example', { url: 'gone.example', verdict: 'dead', reason: 'dns', at: DAY1 }, DAY1)
    rec = recordCheck(rec, 'e1', 'gone.example', { url: 'gone.example', verdict: 'dead', reason: 'dns', at: DAY2 }, DAY2)
    expect(rec.deadDays).toBe(2)
    const links = deadLinks([entry({ url: 'gone.example' })], { e1: rec })
    expect(links).toHaveLength(1)
    expect(links[0].reason).toBe('dns')
    expect(deadLinkDetail(links[0])).toContain('2 hari')
  })

  it('clears the finding as soon as the site answers again', () => {
    let rec = recordCheck(undefined, 'e1', 'u', { url: 'u', verdict: 'dead', reason: 'dns', at: DAY1 }, DAY1)
    rec = recordCheck(rec, 'e1', 'u', { url: 'u', verdict: 'dead', reason: 'dns', at: DAY2 }, DAY2)
    rec = recordCheck(rec, 'e1', 'u', { url: 'u', verdict: 'alive', at: DAY2 + 1 }, DAY2)
    expect(rec.deadDays).toBe(0)
    expect(deadLinks([entry({ url: 'n/a' })], { e1: rec })).toHaveLength(0)
  })

  it('does not let an unknown result add evidence', () => {
    let rec = recordCheck(undefined, 'e1', 'u', { url: 'u', verdict: 'dead', reason: 'dns', at: DAY1 }, DAY1)
    rec = recordCheck(rec, 'e1', 'u', { url: 'u', verdict: 'unclear', reason: 'timeout', at: DAY2 }, DAY2)
    expect(rec.deadDays).toBe(1)
  })

  it('starts over when the entry points somewhere new', () => {
    // Yesterday's evidence is about a different address, so it says nothing about this
    // one.
    const rec = recordCheck(undefined, 'e1', 'old.example', { url: 'old.example', verdict: 'dead', reason: 'dns', at: DAY1 }, DAY1)
    const moved = recordCheck(rec, 'e1', 'new.example', { url: 'new.example', verdict: 'dead', reason: 'dns', at: DAY2 }, DAY2)
    expect(moved.deadDays).toBe(1)
  })
})

describe('what the page reports', () => {
  it('drops findings for entries that are gone', () => {
    let rec = recordCheck(undefined, 'e1', 'u', { url: 'u', verdict: 'dead', reason: 'dns', at: DAY1 }, DAY1)
    rec = recordCheck(rec, 'e1', 'u', { url: 'u', verdict: 'dead', reason: 'dns', at: DAY2 }, DAY2)
    expect(deadLinks([], { e1: rec })).toHaveLength(0)
  })

  it('drops stale findings when the entry now points elsewhere', () => {
    let rec = recordCheck(undefined, 'e1', 'old.example', { url: 'old.example', verdict: 'dead', reason: 'dns', at: DAY1 }, DAY1)
    rec = recordCheck(rec, 'e1', 'old.example', { url: 'old.example', verdict: 'dead', reason: 'dns', at: DAY2 }, DAY2)
    expect(deadLinks([entry({ url: 'new.example' })], { e1: rec })).toHaveLength(0)
  })

  it('will not start a check with nothing to check or one already running', () => {
    expect(canStartCheck({ total: 0, running: false })).toBe(false)
    expect(canStartCheck({ total: 5, running: true })).toBe(false)
    expect(canStartCheck({ total: 5, running: false })).toBe(true)
  })

  it('counts what is left to visit', () => {
    expect(remainingCount(10, 4)).toBe(6)
    expect(remainingCount(10, 10)).toBe(0)
    expect(remainingCount(10, 12)).toBe(0)
  })
})
