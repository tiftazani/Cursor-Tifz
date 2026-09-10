import type { Entry } from '../types'
import { newId } from './id'
import { hostFromUrl } from './match'

export type DuplicateReason = 'same-site' | 'same-login' | 'same-name'

export interface DuplicateMember {
  id: string
  name: string
  username: string
  host: string
  updatedAt: number
  createdAt: number
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

export function hostsOf(entry: Entry): string[] {
  const out = new Set<string>()
  for (const raw of [entry.url, ...(entry.urls ?? []), entry.name, entry.appName]) {
    if (!raw) continue
    const host = hostFromUrl(raw)
    if (host) out.add(host)
  }
  return [...out]
}

function shareHost(a: Entry, b: Entry): boolean {
  const ha = hostsOf(a)
  const hb = hostsOf(b)
  if (!ha.length || !hb.length) return false
  return ha.some((h) => hb.includes(h))
}

export function relatedDuplicate(a: Entry, b: Entry): DuplicateReason | null {
  if (a.id === b.id) return null
  const skip = new Set(['note', 'totp'])
  if (skip.has(a.type) || skip.has(b.type)) return null

  const ua = normUser(a.username)
  const ub = normUser(b.username)
  const sameUser = Boolean(ua && ub && ua === ub)
  const bothEmptyUser = !ua && !ub
  const host = shareHost(a, b)
  const na = normEntryName(a)
  const nb = normEntryName(b)
  const sameName = Boolean(na && nb && na === nb && na.length >= 3)
  const samePass = Boolean(a.password && b.password && a.password === b.password)

  if (host && (sameUser || bothEmptyUser)) return 'same-site'
  if (sameUser && samePass && (host || sameName)) return 'same-login'
  if (sameName && (sameUser || bothEmptyUser || !ua || !ub)) return 'same-name'
  return null
}

function find(parent: number[], i: number): number {
  while (parent[i] !== i) {
    parent[i] = parent[parent[i]]
    i = parent[i]
  }
  return i
}

function memberOf(entry: Entry): DuplicateMember {
  return {
    id: entry.id,
    name: entry.name || entry.appName || 'Tanpa nama',
    username: entry.username ?? '',
    host: hostsOf(entry)[0] || '',
    updatedAt: entry.updatedAt,
    createdAt: entry.createdAt,
  }
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

  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const reason = relatedDuplicate(pool[i], pool[j])
      if (!reason) continue
      const a = find(parent, i)
      const b = find(parent, j)
      if (a === b) continue
      parent[b] = a
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
    const keepId = members[0].id
    const passwords = [...new Set(group.map((e) => e.password || '').filter(Boolean))]
    const passwordConflict = passwords.length > 1
    const host = members.find((m) => m.host)?.host || members[0].name
    const reason = reasonByRoot.get(root) ?? 'same-name'
    clusters.push({
      id: `dup-${members.map((m) => m.id).sort().join('-')}`,
      reason,
      title: host,
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
