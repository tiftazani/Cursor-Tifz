import type { Entry } from '../types'
import { newId } from './id'
import { hostFromUrl, layerFromUrl, nameMatchesHost } from './match'

export type DuplicateReason = 'same-site' | 'same-login' | 'same-name'

/** An entry that holds a one-time code, not a reusable password. */
const OTP_NAME = /\b(otp|one[-_ ]?time|totp|2fa|mfa|authenticator|verification code|kode (otp|verifikasi))\b/i

export interface DuplicateMember {
  id: string
  name: string
  username: string
  host: string
  /** Company/organisation the login belongs to, when the site asked for one. */
  tenant?: string
  updatedAt: number
  createdAt: number
}

/**
 * Which entry of a group the card should pre-select, i.e. the one to keep.
 *
 * This used to be simply the most recently edited member, and that is not a quality
 * signal. Two rows for one site can differ in ways a person can see at a glance: one
 * name is still a raw url while the other reads `site (account)`, and only one of them
 * carries a username. Presenting the raw one as the recommendation asks the user to
 * confirm a worse entry.
 *
 * The order below is deliberate, highest first, and the first difference decides:
 * an account beats no account, a human-readable name beats a raw url, a name that says
 * more than the bare host beats one that repeats it, and a stored password beats an
 * empty one. Recency is only the tie-break, so equal rows keep the old behaviour.
 *
 * A group whose passwords CONFLICT still gets a pre-selection, but it is never safe to
 * act on: `passwordConflict` drives the card to `Cek dulu`, and no rule here can know
 * which of two different passwords is the real one. Auto-filling the choice is not the
 * same as auto-applying it.
 */
function pickKeeper(group: Entry[], members: DuplicateMember[]): DuplicateMember {
  const byId = new Map(group.map((e) => [e.id, e]))
  const quality = (m: DuplicateMember) => {
    const src = byId.get(m.id)
    const name = (m.name || '').trim()
    const host = (m.host || '').trim().toLowerCase()
    const lower = name.toLowerCase()
    // A url got stored as the name. Only a scheme (or a path after the host) proves it:
    // a bare `agoda.com` is a perfectly good name, and treating it as a raw url made
    // `www.agoda.com` look like the better row.
    const rawUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(name) || /^[\w.-]+\.(com|net|org|id|io|app|co\.id)(\/\S*)?$/i.test(name) && name.includes('/')
    // The name repeats the host instead of adding the account the user recognises.
    // `www.` is stripped from BOTH sides: the host already arrives with it removed, so
    // comparing `www.agoda.com` against `agoda.com` unnormalised made the prefixed row
    // look like the more informative name and win the tier.
    const stripWww = (s: string) => s.replace(/^www\./, '')
    const bareHost = lower === host || stripWww(lower) === stripWww(host) || lower.startsWith(`${host}/`)
    const wwwNoise = /^www\./.test(lower) ? 0 : 1
    return [
      (src?.username || '').trim() ? 1 : 0,
      rawUrl ? 0 : 1,
      bareHost ? 0 : 1,
      wwwNoise,
      (src?.password || '').length ? 1 : 0,
      // Seconds since the epoch, scaled so one edit cannot outweigh a whole tier.
      m.updatedAt / 1e13,
    ]
  }
  let best = members[0]
  let bestScore = quality(best)
  for (const m of members.slice(1)) {
    const score = quality(m)
    for (let i = 0; i < score.length; i++) {
      if (score[i] === bestScore[i]) continue
      if (score[i] > bestScore[i]) {
        best = m
        bestScore = score
      }
      break
    }
  }
  return best
}

export interface DuplicateCluster {
  id: string
  reason: DuplicateReason
  title: string
  detail: string
  suggestion: 'merge' | 'delete'
  keepId: string
  memberIds: string[]
  members: DuplicateMember[]
  passwordConflict: boolean
}

export function maskAccount(value?: string): string {
  const v = (value ?? '').trim()
  if (!v) return '—'
  const at = v.indexOf('@')
  if (at > 0) return `${v.slice(0, 1)}•••${v.slice(at)}`
  if (v.length <= 3) return '•••'
  return `${v.slice(0, 2)}•••`
}

function normUser(u?: string): string {
  return (u ?? '').trim().toLowerCase()
}

export function normEntryName(entry: Entry): string {
  const raw = (entry.name || entry.appName || '').trim().toLowerCase()
  return raw
    .replace(/^www\./, '')
    .replace(/\.(com|co\.id|net|org|id|io|app)\/?$/i, '')
    .replace(/[^a-z0-9]+/g, '')
}

/**
 * The host the entry was actually saved for.
 *
 * Only `url`, or the first entry of `urls`, counts. Reading the whole `urls`
 * list as identity was a bug: `urls` is a merge history, so one entry that
 * once picked up a foreign url (a merge, or a save on a shared login page)
 * became a bridge between two unrelated sites. Reading `name` as a host was the
 * same bug one step smaller: two rows both called "amazon" that point at
 * different sites looked like one site.
 */
export function entryHost(entry: Entry): string {
  return hostFromUrl(entry.url || entry.urls?.[0] || '') || ''
}

/**
 * Which credential layer of a site an entry belongs to, taken from the URL path.
 * One site can ask for a password in more than one place (site login, then a
 * payment or transfer PIN), and those are separate credentials that must not be
 * merged just because the host matches.
 */
export function layerOf(entry: Entry): string {
  return layerFromUrl(entry.url || entry.urls?.[0] || '')
}

function shareHost(a: Entry, b: Entry): boolean {
  const ha = entryHost(a)
  const hb = entryHost(b)
  if (ha && hb) return ha === hb
  if (ha || hb) {
    // One side has no URL at all: the other side's host may still match this
    // entry's name, and only as a whole domain label.
    const named = ha ? b : a
    const host = ha || hb
    // The nameless side must not name a DIFFERENT site. Without this, a bare entry
    // called "mail" matched both mail.google.com and mail.yahoo.com (nameMatchesHost
    // matches a bare label against the site label), and union-find fused those two
    // sites into one cluster with a suggestion to delete one of them.
    const ownHost = hostFromUrl((named.name || named.appName || '').trim())
    if (ownHost && ownHost !== host) return false
    return nameMatchesHost((named.name || named.appName || '').toLowerCase(), host)
  }
  // Neither side has a URL, so the name is the only thing left to compare.
  const na = hostFromUrl((a.name || a.appName || '').trim())
  const nb = hostFromUrl((b.name || b.appName || '').trim())
  return Boolean(na && nb && na === nb)
}

function shareLayer(a: Entry, b: Entry): boolean {
  const la = layerOf(a)
  const lb = layerOf(b)
  if (la === lb) return true
  // Only the site root is generic enough to stand in for a named layer. /login and
  // /transfer/confirm are two different prompts, not the same credential.
  const root = (p: string) => p === '' || p === '/'
  // The root may stand in for a NAMED layer, but never bridge two named layers:
  // a bare "https://bank.example.com" entry would otherwise fuse /login with
  // /transfer/confirm, and the cluster then advises deleting one of two genuinely
  // different credentials. A root-vs-root match is already covered by `la === lb`.
  if (root(la) && root(lb)) return false
  return (root(la) && lb !== '') || (root(lb) && la !== '')
}

export function relatedDuplicate(a: Entry, b: Entry): DuplicateReason | null {
  if (a.id === b.id) return null
  const skip = new Set(['note', 'totp'])
  if (skip.has(a.type) || skip.has(b.type)) return null
  // An OTP code is not a saved password; it never belongs in a duplicate cluster.
  if (OTP_NAME.test(`${a.name} ${a.appName ?? ''}`) || OTP_NAME.test(`${b.name} ${b.appName ?? ''}`)) return null

  const ua = normUser(a.username)
  const ub = normUser(b.username)
  const sameUser = Boolean(ua && ub && ua === ub)
  const bothEmptyUser = !ua && !ub
  const host = shareHost(a, b)
  const layer = shareLayer(a, b)
  const sameSite = host && layer
  const na = normEntryName(a)
  const nb = normEntryName(b)
  const sameName = Boolean(na && nb && na === nb && na.length >= 3)
  const samePass = Boolean(a.password && b.password && a.password === b.password)
  const ta = tenantOf(a).toLowerCase()
  const tb = tenantOf(b).toLowerCase()

  // Two accounts on the same site with different usernames are not duplicates.
  if (sameSite && ua && ub && !sameUser) return null
  // Same site, same (or empty) username, but two different companies: a shared-login
  // site where each company gets its own password. Keeping them is the only way the
  // user can reach the right one, and "delete the others" would destroy a live login.
  if (sameSite && ta && tb && ta !== tb) return null
  // One company, two people. Those are separate accounts by definition, and the
  // cluster's advice would be to delete one of them.
  if (sameSite && ta && tb && ta === tb && ua && ub && !sameUser) return null

  if (sameSite && (sameUser || bothEmptyUser)) return 'same-site'
  if (host && layer && sameUser && samePass) return 'same-login'
  // A similar name alone is not enough: cross-host name matches used to chain
  // unrelated services into one cluster.
  if (sameSite && sameName) return 'same-name'
  return null
}

function find(parent: number[], i: number): number {
  while (parent[i] !== i) {
    parent[i] = parent[parent[i]]
    i = parent[i]
  }
  return i
}

export function memberOf(entry: Entry): DuplicateMember {
  return {
    id: entry.id,
    name: entry.name || entry.appName || 'Tanpa nama',
    username: entry.username ?? '',
    host: entryHost(entry),
    tenant: tenantOf(entry),
    updatedAt: entry.updatedAt,
    createdAt: entry.createdAt,
  }
}

/**
 * Which company/organisation the login belongs to. A site that asks for a shared
 * password before the personal one produces several rows that look identical except
 * for the username; the company is the only thing that tells them apart.
 */
export function tenantOf(entry: Entry): string {
  const field = (entry.customFields || []).find(
    (f) => (f.label || '').toLowerCase() === 'perusahaan' || (f.label || '').toLowerCase() === 'company',
  )
  if (field?.value) return field.value
  // appName is the same company on entries Kunci saved itself. It is only read when
  // the name does NOT already carry it, so an older entry named "Talentradar · PT X"
  // is not read as a company called "Talentradar · PT X".
  if (entry.appName && entry.name && !entry.name.toLowerCase().includes(entry.appName.toLowerCase())) {
    return entry.appName
  }
  // Neither field is there, but the name Kunci wrote is "Site · Company". That suffix
  // is the company, and without it two companies on one site look like one duplicate.
  const suffix = companyFromName(entry.name || '')
  return suffix
}

/** The company suffix Kunci writes into a saved login name, or ''. */
function companyFromName(name: string): string {
  const at = name.indexOf(' · ')
  return at > 0 ? name.slice(at + 3).trim() : ''
}

const REASON_COPY: Record<DuplicateReason, string> = {
  'same-site': 'Situs yang sama, akun kelihatan dobel',
  'same-login': 'Username dan password sama',
  'same-name': 'Nama entri hampir sama',
}

export function findDuplicateClusters(entries: Entry[]): DuplicateCluster[] {
  const pool = entries.filter((e) => e.type === 'login' || e.type === 'app' || e.type === 'password')
  const parent = pool.map((_, i) => i)
  const reasonByRoot = new Map<number, DuplicateReason>()
  // The named layer each group holds. A group may hold at most one: otherwise a
  // bare "https://bank.example.com" entry pairs with both /login and
  // /transfer/confirm (each pairing is fine on its own) and union-find fuses the
  // two into one cluster whose advice is to DELETE one of two different
  // credentials. A cluster that spans two layers is never correct.
  const namedLayer = pool.map((e) => {
    const l = layerOf(e)
    return l && l !== '/' ? l : ''
  })
  const layersByRoot = new Map<number, Set<string>>()

  const layersOf = (root: number): Set<string> => {
    const existing = layersByRoot.get(root)
    if (existing) return existing
    const fresh = new Set<string>()
    if (namedLayer[root]) fresh.add(namedLayer[root]!)
    layersByRoot.set(root, fresh)
    return fresh
  }

  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const reason = relatedDuplicate(pool[i], pool[j])
      if (!reason) continue
      const a = find(parent, i)
      const b = find(parent, j)
      if (a === b) continue
      const la = layersOf(a)
      const lb = layersOf(b)
      const merged = new Set([...la, ...lb])
      if (merged.size > 1) continue
      parent[b] = a
      layersByRoot.set(a, merged)
      reasonByRoot.set(a, reasonByRoot.get(a) ?? reason)
    }
  }

  const groups = new Map<number, Entry[]>()
  for (let i = 0; i < pool.length; i++) {
    const root = find(parent, i)
    const list = groups.get(root) ?? []
    list.push(pool[i])
    groups.set(root, list)
  }

  const clusters: DuplicateCluster[] = []
  for (const [root, group] of groups) {
    if (group.length < 2) continue
    const members = group.map(memberOf).sort((a, b) => b.updatedAt - a.updatedAt)
    const keepId = pickKeeper(group, members).id
    const passwords = [...new Set(group.map((e) => e.password || '').filter(Boolean))]
    const passwordConflict = passwords.length > 1
    const host = members.find((m) => m.host)?.host || members[0].name
    // Show the layer when it is not the site root, so two credentials on one host
    // (site login vs payment PIN) are readable as different things. The company name
    // goes on the title too: several logins for the same site differ ONLY by company.
    const layer = group.map(layerOf).find((p) => p && p !== '/') || ''
    const tenant = group.map(tenantOf).find(Boolean) || ''
    const reason = reasonByRoot.get(root) ?? 'same-name'
    clusters.push({
      id: `dup-${members.map((m) => m.id).sort().join('-')}`,
      reason,
      title: `${host}${layer}${tenant ? ` · ${tenant}` : ''}`,
      detail: `${group.length} entri · ${REASON_COPY[reason]}`,
      suggestion: passwordConflict ? 'delete' : 'merge',
      keepId,
      memberIds: members.map((m) => m.id),
      members,
      passwordConflict,
    })
  }

  return clusters.sort((a, b) => b.members.length - a.members.length)
}

export function mergeEntriesInto(keep: Entry, others: Entry[], now = Date.now()): Entry {
  const all = [keep, ...others]
  const urls = [...new Set(all.flatMap((e) => [e.url, ...e.urls].filter(Boolean)))] as string[]
  const tags = [...new Set(all.flatMap((e) => e.tags))]
  const notes = all
    .map((e) => (e.notes || '').trim())
    .filter(Boolean)
    .filter((note, i, arr) => arr.indexOf(note) === i)
    .join('\n\n')
  const history = [
    ...keep.history,
    ...others.flatMap((o) => [
      ...o.history,
      {
        id: newId(),
        username: o.username,
        password: o.password,
        changedAt: o.updatedAt,
      },
    ]),
  ].slice(0, 50)
  const used = all.map((e) => e.lastUsedAt ?? 0)
  const lastUsed = Math.max(0, ...used)

  return {
    ...keep,
    name: keep.name || others.find((o) => o.name)?.name || keep.name,
    username: keep.username || others.find((o) => o.username)?.username,
    password: keep.password || others.find((o) => o.password)?.password,
    url: keep.url || urls[0],
    urls,
    appName: keep.appName || others.find((o) => o.appName)?.appName,
    notes: notes || keep.notes,
    totpSecret: keep.totpSecret || others.find((o) => o.totpSecret)?.totpSecret,
    tags,
    favorite: all.some((e) => e.favorite),
    customFields: keep.customFields.length ? keep.customFields : (others.find((o) => o.customFields.length)?.customFields ?? []),
    history,
    createdAt: Math.min(...all.map((e) => e.createdAt)),
    updatedAt: now,
    lastUsedAt: lastUsed || keep.lastUsedAt,
    passwordChangedAt: keep.passwordChangedAt ?? others.find((o) => o.passwordChangedAt)?.passwordChangedAt,
  }
}
