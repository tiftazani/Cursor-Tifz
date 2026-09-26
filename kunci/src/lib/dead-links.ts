import type { Entry } from '../types'
import { hostFromUrl } from './match'

/**
 * Working out which saved sites have gone away.
 *
 * How the check actually works, and why it works this way: the app has no server it can
 * ask, and the browser refuses to read the answer from another domain. Every ordinary
 * way of asking is therefore blind. `fetch()` and an `<img>` probe both report a closed
 * site, a private site, and a site with a bad certificate as the same generic failure,
 * so neither can tell a dead site from a working one and both would condemn a whole
 * vault. What does separate them is how long the failure takes. A domain that no longer
 * exists is rejected by the name resolver almost instantly, while a site that is alive
 * but unwilling to talk still has to be contacted first. Measured in a real browser:
 * unresolvable domains failed in 1 to 23 ms, every live host in 78 to 1376 ms.
 *
 * The honest limit of this, which the page states to the user as well: it finds domains
 * that no longer resolve. It cannot see a site that shut down while keeping its domain,
 * and it does not judge whether the service still fits the entry.
 */

export type UrlVerdict =
  /** The name resolved, so the site is still there. */
  | 'alive'
  /** The name itself failed, which is what a domain that lapsed or was deleted looks like. */
  | 'dead'
  /** Nothing was proved: a timeout, a blocked request, or an unnecessary check. */
  | 'unclear'

/** Why a check reached its verdict. Only `dns` ever means the site is gone. */
export type FailReason = 'dns' | 'timeout' | 'blocked' | 'offline'

export interface UrlCheck {
  url: string
  verdict: UrlVerdict
  reason?: FailReason
  /** How long the probe took. Kept because the verdict comes from this number. */
  ms?: number
  at: number
}

/**
 * The failure that is faster than any real answer can be.
 *
 * 25 ms, and the number comes from a two-probe rule rather than a single one. A dead name
 * is slow exactly once: the first lookup has to travel to the resolver and come back
 * empty, which measured 32 to 1101 ms, and that overlaps live hosts (89 to 214 ms), so a
 * single slow failure proves nothing. But the resolver then remembers the empty answer,
 * and the same name fails again in 1 to 2 ms. A live host has no such shortcut, because
 * its lookup succeeds and the connection still has to be made and refused.
 *
 * So the fastest of two attempts is what gets compared. Measured across a spread of real
 * hosts: dead names bottomed out at 1 to 2 ms (12 of 12, and 0 of 12 stayed slow), while
 * the fastest live host measured was 43 ms (cloudflare.com), with the rest from 67 ms to
 * 6 seconds. 25 ms sits in that gap, well clear of both sides.
 */
export const DEAD_BEFORE_MS = 25

/**
 * Hosts that cannot be judged from here, and so are never asked about.
 *
 * An address on the user's own network is the reason this exists. It resolves inside the
 * office and nowhere else, so a probe from a laptop at home would fail and the entry
 * would be condemned for being somewhere the check cannot reach. The same goes for a
 * machine's own name and for bare IP addresses, which say nothing about a public site.
 * Skipping them is what keeps this from accusing working entries.
 */
export function looksPublicHost(host: string): boolean {
  const h = host.trim().toLowerCase().replace(/^\[|\]$/g, '')
  if (!h.includes('.')) return false
  // An IP address is not a name, and a private one is not even reachable.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return false
  if (h.includes(':')) return false // IPv6 literal
  // Names that only mean something inside one network.
  const reserved = ['.local', '.localhost', '.internal', '.intranet', '.lan', '.home', '.corp', '.localdomain', '.test', '.invalid', '.example']
  if (reserved.some((s) => h === s.slice(1) || h.endsWith(s))) return false
  // A name with no dot in its last label cannot be a public domain.
  const last = h.split('.').pop() ?? ''
  return /^[a-z]{2,}$/.test(last)
}

/** One entry's gathered evidence, kept in the vault so it survives a reload. */
export interface UrlHealthRecord {
  entryId: string
  url: string
  /** Consecutive days this url has failed hard. Two is the bar for calling it dead. */
  deadDays: number
  /** The day (local, YYYY-MM-DD) of the last check, so one day is only counted once. */
  lastDay: string
  lastReason?: FailReason
  lastAt: number
}

/** Local calendar day. A day is a local idea, and the user's midnight is the one that counts. */
export function dayKey(now: number): string {
  const d = new Date(now)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * The address worth testing for an entry.
 *
 * The host is tested, not the full link, because `example.com/login` and `example.com`
 * are the same site for this purpose and testing both would double the work to reach
 * the same answer. The entry's own link wins, as that is the one the user visits.
 */
export function checkableUrl(entry: Entry): string | null {
  const candidates = [entry.url, ...entry.urls].filter((u): u is string => Boolean(u && u.trim()))
  for (const raw of candidates) {
    const url = raw.trim()
    let host: string | null = null
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
      host = hostFromUrl(url)
    } else if (/^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(url)) {
      host = hostFromUrl(`https://${url}`)
    }
    if (host && host.includes('.') && looksPublicHost(host)) return host
  }
  return null
}

/** Entries that have a site to test. */
export function checkableEntries(entries: Entry[]): Entry[] {
  return entries.filter((e) => checkableUrl(e) !== null)
}

/**
 * The distinct addresses a run should probe.
 *
 * A real vault saves the same site many times, so probing entry by entry asks one host
 * the same question over and over and makes a large vault take far longer than it needs
 * to. Each address is visited once, and the single answer is then applied to every entry
 * that points there.
 */
export function hostsToProbe(entries: Entry[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const e of entries) {
    const host = checkableUrl(e)
    if (!host || seen.has(host)) continue
    seen.add(host)
    out.push(host)
  }
  return out
}

/**
 * Read two probe attempts at one host.
 *
 * Both attempts are needed, and neither alone is enough. A dead name is slow on its first
 * lookup and fast on the second, so only a fast *repeat* proves the name is gone. A live
 * host fails slowly both times, because it has to be contacted and refuse.
 *
 * The important case is a slow failure on both attempts: it proves nothing at all. It
 * might be a dead name on a cold resolver or a live site that is merely unreachable from
 * here, and those must not be told apart by guessing. It is reported as `unclear`, which
 * leaves the evidence count alone, rather than as `alive`, which would wipe a genuine
 * finding. Erring this way costs a second day of waiting; the other way loses a real
 * finding.
 */
export function verdictFromProbe(attempts: { ms: number; reportedAlive: boolean; timedOut: boolean }[]): UrlVerdict {
  // Anything that opened, or answered at all, proves the name resolved.
  if (attempts.some((a) => a.reportedAlive)) return 'alive'
  if (attempts.some((a) => a.timedOut)) return 'unclear'
  // The fastest attempt is the one the resolver answered from memory. A live host has no
  // such shortcut and cannot come back this fast on any attempt.
  const fastest = Math.min(...attempts.map((a) => a.ms))
  if (fastest < DEAD_BEFORE_MS) return 'dead'
  // Slow to fail every time: a real answer could not be obtained, so nothing is proved.
  return 'unclear'
}

/** The reason to record alongside a dead verdict. */
export function reasonFor(verdict: UrlVerdict, timedOut: boolean): FailReason | undefined {
  if (verdict === 'alive') return undefined
  if (timedOut) return 'timeout'
  // A slow failure that reached the network but got nowhere is a block, not a missing name.
  return verdict === 'dead' ? 'dns' : 'blocked'
}

/**
 * Fold one day's results into the record for an entry.
 *
 * The day-gate is the whole point: a single bad minute cannot accumulate two days'
 * worth of evidence no matter how often it is retried, because the second day must
 * actually be a different day.
 */
export function recordCheck(
  prev: UrlHealthRecord | undefined,
  entryId: string,
  url: string,
  check: UrlCheck,
  now: number,
): UrlHealthRecord {
  const today = dayKey(now)
  // A record about a different address says nothing about this one, so it starts over.
  const base: UrlHealthRecord = prev && prev.url === url
    ? prev
    : { entryId, url, deadDays: 0, lastDay: today, lastAt: now }

  if (check.verdict === 'alive') {
    // The name resolved, so any history of failure is settled.
    return { ...base, deadDays: 0, lastReason: undefined, lastDay: today, lastAt: now }
  }
  if (check.verdict === 'unclear') {
    // Inconclusive results must not advance the count, but they do count as having
    // looked today, so a retry the same day cannot be mistaken for a new day.
    return { ...base, lastDay: today, lastAt: now }
  }
  // Already counted a failure today, so this run adds nothing. Retrying in a loop
  // cannot reach the two-day bar.
  if (base.lastDay === today && base.deadDays > 0) {
    return { ...base, lastReason: check.reason ?? base.lastReason, lastAt: now }
  }
  // A different day counts as a new day of evidence, whichever direction the clock
  // moved. Comparing only "is this a later day" would stall for a whole day if the
  // clock is corrected, or if evidence was written on a machine whose date was wrong,
  // which is exactly when a user would think the check had simply stopped working.
  return {
    ...base,
    deadDays: base.deadDays + 1,
    lastReason: check.reason ?? base.lastReason,
    lastDay: today,
    lastAt: now,
  }
}

/** An entry whose site failed hard on two different days. */
export interface DeadLink {
  entryId: string
  entryName: string
  url: string
  since: number
  reason: FailReason
  deadDays: number
}

/** The bar for calling a site dead. Two days, so a bad afternoon is not enough. */
export const DEAD_DAYS = 2

/**
 * The entries whose site is gone, oldest finding first.
 *
 * Derived from stored records rather than computed fresh, so a finding survives a
 * reload and can be explained ("failed 2 days running") instead of just asserted.
 */
export function deadLinks(entries: Entry[], records: Record<string, UrlHealthRecord>): DeadLink[] {
  const byId = new Map(entries.map((e) => [e.id, e]))
  const out: DeadLink[] = []
  for (const rec of Object.values(records)) {
    if (rec.deadDays < DEAD_DAYS) continue
    const entry = byId.get(rec.entryId)
    // The entry may have been deleted or moved to the trash since the check ran.
    if (!entry) continue
    // The finding is stale if the entry now points somewhere else.
    if (checkableUrl(entry) !== rec.url) continue
    out.push({
      entryId: entry.id,
      entryName: entry.name,
      url: rec.url,
      since: rec.lastAt,
      reason: rec.lastReason ?? 'dns',
      deadDays: rec.deadDays,
    })
  }
  return out.sort((a, b) => b.deadDays - a.deadDays || a.since - b.since || a.entryId.localeCompare(b.entryId))
}

export const REASON_TEXT: Record<FailReason, string> = {
  dns: 'Alamatnya tidak ditemukan lagi',
  timeout: 'Tidak menjawab',
  blocked: 'Koneksi diblokir',
  offline: 'Tidak ada koneksi internet',
}

export function deadLinkDetail(link: DeadLink): string {
  return `${REASON_TEXT[link.reason]} · gagal ${link.deadDays} hari berturut-turut`
}

/**
 * Whether to run the probe with a timeout, and how long.
 *
 * A probe that is allowed to hang would stall the run on one unreachable site, so every
 * check is on a leash. Ten seconds is short enough to keep a large vault moving and long
 * enough that a slow but live site is not cut off mid-answer.
 */
export const PROBE_TIMEOUT_MS = 10_000

/**
 * How long to wait before asking a host the second time.
 *
 * Long enough that the second attempt is a new lookup rather than a repeat of the first,
 * short enough not to slow a large vault down. The wait costs nothing in practice, since
 * hosts are checked a few at a time.
 */
export const PROBE_REPEAT_GAP_MS = 150

/**
 * How many entries are checked at once.
 *
 * Kept low on purpose. This runs from the user's own browser and their own connection,
 * and firing hundreds of requests at once would be indistinguishable from an attack on
 * the sites involved.
 */
export const PROBE_CONCURRENCY = 4

/** Whether a check is worth starting. */
export function canStartCheck(opts: { total: number; running: boolean }): boolean {
  return opts.total > 0 && !opts.running
}

/** How many entries one run still has to visit. Shown to the user while it works. */
export function remainingCount(total: number, done: number): number {
  return Math.max(0, total - done)
}

/**
 * Entries that failed once and are waiting for a second day to be called dead.
 *
 * Worth showing. The rule only names a site after two different days, so a first run
 * that finds failures reports "nothing new" while actually having found something. A
 * user who cannot see that pending evidence reads the silence as a broken check and
 * runs it again, which cannot help, because the second day has to be a real day.
 */
export function pendingCount(entries: Entry[], records: Record<string, UrlHealthRecord>): number {
  const byId = new Map(entries.map((e) => [e.id, e]))
  let n = 0
  for (const rec of Object.values(records)) {
    if (rec.deadDays <= 0 || rec.deadDays >= DEAD_DAYS) continue
    const entry = byId.get(rec.entryId)
    if (!entry) continue
    if (checkableUrl(entry) !== rec.url) continue
    n++
  }
  return n
}

/**
 * The line the user reads before agreeing to a check.
 *
 * Says how many sites will be contacted and the one thing they must know: those sites
 * will see this computer's address. Asking for that agreement is not optional, because
 * the check tells a third party that the user holds an account there.
 */
export function checkDisclosure(total: number): string {
  return `Kunci akan menghubungi ${total} alamat situs dari komputer ini untuk melihat mana yang masih ada. Situs-situs itu akan melihat alamat IP kamu. Nama pengguna dan sandi tidak ikut dikirim.`
}
