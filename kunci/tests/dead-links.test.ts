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
  hostsToProbe,
  pendingCount,
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
  it('calls a name dead when a repeat lookup comes back instantly', () => {
    // A dead name is slow once, then the resolver remembers the empty answer. Measured:
    // first attempt 32 to 1101 ms, second 1 to 2 ms.
    expect(verdictFromProbe([{ ms: 476, reportedAlive: false, timedOut: false }, { ms: 2, reportedAlive: false, timedOut: false }])).toBe('dead')
    expect(verdictFromProbe([{ ms: 43, reportedAlive: false, timedOut: false }, { ms: 1, reportedAlive: false, timedOut: false }])).toBe('dead')
  })

  it('does not condemn a host from a fast first attempt alone', () => {
    // The trap this rule exists for: a dead name can also be fast on the first try if
    // the resolver already has it, so the second attempt is what carries the verdict.
    expect(verdictFromProbe([{ ms: 2, reportedAlive: false, timedOut: false }, { ms: 2, reportedAlive: false, timedOut: false }])).toBe('dead')
  })

  it('never calls a live host dead, however fast it refused', () => {
    // The fastest live host measured was cloudflare.com at 43 ms, and it stayed slow on
    // both attempts. Nothing that fails slowly twice may be read as a missing name.
    expect(verdictFromProbe([{ ms: 43, reportedAlive: false, timedOut: false }, { ms: 45, reportedAlive: false, timedOut: false }])).toBe('unclear')
    expect(verdictFromProbe([{ ms: 104, reportedAlive: false, timedOut: false }, { ms: 103, reportedAlive: false, timedOut: false }])).toBe('unclear')
    expect(verdictFromProbe([{ ms: 6033, reportedAlive: false, timedOut: false }, { ms: 6108, reportedAlive: false, timedOut: false }])).toBe('unclear')
  })

  it('leaves evidence alone rather than wiping it when a site is merely unreachable', () => {
    // This is the bug the two-probe rule fixed. A slow failure used to be read as
    // 'alive', which reset a real finding. Now it proves nothing, so the count survives.
    const slow = [{ ms: 300, reportedAlive: false, timedOut: false }, { ms: 320, reportedAlive: false, timedOut: false }]
    expect(verdictFromProbe(slow)).toBe('unclear')
    let rec = recordCheck(undefined, 'e1', 'u', { url: 'u', verdict: 'dead', reason: 'dns', at: DAY1 }, DAY1)
    rec = recordCheck(rec, 'e1', 'u', { url: 'u', verdict: verdictFromProbe(slow), reason: reasonFor(verdictFromProbe(slow), false), at: DAY2 }, DAY2)
    expect(rec.deadDays).toBe(1)
  })

  it('calls anything that answered alive', () => {
    expect(verdictFromProbe([{ ms: 5000, reportedAlive: true, timedOut: false }])).toBe('alive')
    expect(verdictFromProbe([{ ms: 90, reportedAlive: false, timedOut: false }, { ms: 5000, reportedAlive: true, timedOut: false }])).toBe('alive')
  })

  it('treats a timeout as unknown, never as death', () => {
    // A site that is merely slow must not be condemned, however long it took.
    expect(verdictFromProbe([{ ms: 10_000, reportedAlive: false, timedOut: true }])).toBe('unclear')
    expect(reasonFor('unclear', true)).toBe('timeout')
  })

  it('keeps the threshold in the gap between the two measured groups', () => {
    // Dead names bottomed out at 1 to 2 ms across 12 fresh domains; the fastest live host
    // measured was 43 ms. The line has to sit between those, with room on both sides.
    expect(DEAD_BEFORE_MS).toBeGreaterThan(2)
    expect(DEAD_BEFORE_MS).toBeLessThan(43)
  })

  it('records no failure reason for a site that is alive', () => {
    expect(reasonFor('alive', false)).toBeUndefined()
    expect(reasonFor('dead', false)).toBe('dns')
    // A slow failure reached the network but got nowhere, which is a block, not a name.
    expect(reasonFor('unclear', false)).toBe('blocked')
  })
})

describe('hosts that cannot be judged from here', () => {
  it('leaves out addresses on the user\'s own network', () => {
    // An intranet host resolves in the office and nowhere else, so probing it from home
    // would fail and condemn an entry that works perfectly well.
    for (const url of ['http://intranet.local', 'https://portal.corp', 'https://wiki.internal', 'http://printer.lan']) {
      expect(checkableUrl(entry({ url }))).toBeNull()
    }
  })

  it('leaves out bare addresses, which are not names', () => {
    expect(checkableUrl(entry({ url: 'https://192.168.1.10' }))).toBeNull()
    expect(checkableUrl(entry({ url: 'https://10.0.0.5:8443' }))).toBeNull()
  })

  it('leaves out names with no public ending', () => {
    expect(checkableUrl(entry({ url: 'https://router' }))).toBeNull()
  })

  it('still checks an ordinary public site', () => {
    expect(checkableUrl(entry({ url: 'https://github.com' }))).toBe('github.com')
    expect(checkableUrl(entry({ url: 'https://bca.co.id/login' }))).toBe('bca.co.id')
  })
})

describe('gathering evidence across days', () => {
  it('does not call a site dead from a single bad day', () => {
    const rec = recordCheck(undefined, 'e1', 'gone.example.com', { url: 'gone.example.com', verdict: 'dead', reason: 'dns', at: DAY1 }, DAY1)
    expect(rec.deadDays).toBe(1)
    expect(deadLinks([entry({ url: 'gone.example.com' })], { e1: rec })).toHaveLength(0)
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
    let rec = recordCheck(undefined, 'e1', 'gone.example.com', { url: 'gone.example.com', verdict: 'dead', reason: 'dns', at: DAY1 }, DAY1)
    rec = recordCheck(rec, 'e1', 'gone.example.com', { url: 'gone.example.com', verdict: 'dead', reason: 'dns', at: DAY2 }, DAY2)
    expect(rec.deadDays).toBe(2)
    const links = deadLinks([entry({ url: 'gone.example.com' })], { e1: rec })
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
    const rec = recordCheck(undefined, 'e1', 'old.example.com', { url: 'old.example.com', verdict: 'dead', reason: 'dns', at: DAY1 }, DAY1)
    const moved = recordCheck(rec, 'e1', 'new.example.com', { url: 'new.example.com', verdict: 'dead', reason: 'dns', at: DAY2 }, DAY2)
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
    let rec = recordCheck(undefined, 'e1', 'old.example.com', { url: 'old.example.com', verdict: 'dead', reason: 'dns', at: DAY1 }, DAY1)
    rec = recordCheck(rec, 'e1', 'old.example.com', { url: 'old.example.com', verdict: 'dead', reason: 'dns', at: DAY2 }, DAY2)
    expect(deadLinks([entry({ url: 'new.example.com' })], { e1: rec })).toHaveLength(0)
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

describe('probing each address once', () => {
  it('visits a site once however many entries point at it', () => {
    const entries = [
      entry({ id: 'a', url: 'https://same.example.com/login' }),
      entry({ id: 'b', url: 'https://same.example.com/account' }),
      entry({ id: 'c', url: 'https://other.example.com' }),
    ]
    expect(hostsToProbe(entries)).toEqual(['same.example.com', 'other.example.com'])
  })

  it('keeps the order the entries are in, so progress reads sensibly', () => {
    const entries = [entry({ id: 'a', url: 'https://z.example.com' }), entry({ id: 'b', url: 'https://a.example.com' })]
    expect(hostsToProbe(entries)).toEqual(['z.example.com', 'a.example.com'])
  })

  it('skips entries with no address at all', () => {
    expect(hostsToProbe([entry({ id: 'a' }), entry({ id: 'b', url: 'https://a.example.com' })])).toEqual(['a.example.com'])
  })

  it('collapses a vault where every entry is the same site to one probe', () => {
    // The shape a real vault has: one popular site saved over and over.
    const many = Array.from({ length: 200 }, (_, i) => entry({ id: `e${i}`, url: 'https://popular.example.com/login' }))
    expect(hostsToProbe(many)).toEqual(['popular.example.com'])
  })
})

describe('evidence waiting for its second day', () => {
  it('counts a one-day failure as pending rather than dead', () => {
    const rec = recordCheck(undefined, 'e1', 'gone.example.com', { url: 'gone.example.com', verdict: 'dead', reason: 'dns', at: DAY1 }, DAY1)
    const entries = [entry({ url: 'https://gone.example.com' })]
    expect(pendingCount(entries, { e1: rec })).toBe(1)
    expect(deadLinks(entries, { e1: rec })).toHaveLength(0)
  })

  it('stops calling it pending once the second day confirms it', () => {
    let rec = recordCheck(undefined, 'e1', 'gone.example.com', { url: 'gone.example.com', verdict: 'dead', reason: 'dns', at: DAY1 }, DAY1)
    rec = recordCheck(rec, 'e1', 'gone.example.com', { url: 'gone.example.com', verdict: 'dead', reason: 'dns', at: DAY2 }, DAY2)
    const entries = [entry({ url: 'https://gone.example.com' })]
    expect(pendingCount(entries, { e1: rec })).toBe(0)
    expect(deadLinks(entries, { e1: rec })).toHaveLength(1)
  })

  it('does not count a pending record whose entry has been deleted', () => {
    const rec = recordCheck(undefined, 'gone-id', 'gone.example.com', { url: 'gone.example.com', verdict: 'dead', reason: 'dns', at: DAY1 }, DAY1)
    expect(pendingCount([], { 'gone-id': rec })).toBe(0)
  })

  it('does not count a pending record the entry has since been pointed away from', () => {
    const rec = recordCheck(undefined, 'e1', 'old.example.com', { url: 'old.example.com', verdict: 'dead', reason: 'dns', at: DAY1 }, DAY1)
    expect(pendingCount([entry({ url: 'https://new.example.com' })], { e1: rec })).toBe(0)
  })

  it('counts nothing when there is no evidence at all', () => {
    expect(pendingCount([entry({ url: 'https://a.example.com' })], {})).toBe(0)
  })
})
