import type { Entry } from '../types'
import { DEFAULT_CLOUD_URL, LOCAL_APP_ORIGINS } from './allowed-origins'
import { entryMatchesPage, hostFromUrl } from './match'
import { withCredentialHistory } from './history'
import { newId } from './id'

export interface LoginCapture {
  url: string
  username: string
  password: string
}

export type SaveDecision = { action: 'skip'; reason: 'empty' | 'kunci-app' | 'unchanged' } | { action: 'create' } | { action: 'update'; entryId: string }

export function isKunciAppUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    if (LOCAL_APP_ORIGINS.includes(url.origin)) return true
    return url.hostname === new URL(DEFAULT_CLOUD_URL).hostname
  } catch {
    return false
  }
}

export function loginTitleFromUrl(raw: string): string {
  const host = hostFromUrl(raw)
  if (!host) return 'Login'
  const label = host.split('.')[0] || host
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function decideLoginSave(
  entries: Entry[],
  capture: LoginCapture,
  neverHosts: readonly string[] = [],
): SaveDecision {
  const username = capture.username.trim()
  const password = capture.password
  if (!password) return { action: 'skip', reason: 'empty' }
  if (isKunciAppUrl(capture.url)) return { action: 'skip', reason: 'kunci-app' }
  const host = hostFromUrl(capture.url)
  if (host && neverHosts.includes(host)) return { action: 'skip', reason: 'unchanged' }

  const siteLogins = entries.filter((entry) => entry.type !== 'note' && entryMatchesPage(entry, capture.url))
  const sameUser = siteLogins.filter((entry) => (entry.username || '').trim() === username)
  const pool = username ? sameUser : siteLogins
  const unchanged = pool.find((entry) => (entry.password || '') === password && (entry.username || '').trim() === username)
  if (unchanged) return { action: 'skip', reason: 'unchanged' }
  if (pool.length === 1) return { action: 'update', entryId: pool[0]!.id }
  if (sameUser.length === 1) return { action: 'update', entryId: sameUser[0]!.id }
  return { action: 'create' }
}

export function applyLoginCapture(
  entries: Entry[],
  capture: LoginCapture,
  now = Date.now(),
  makeId: () => string = newId,
): { entries: Entry[]; changed: 'skip' | 'create' | 'update' } {
  const decision = decideLoginSave(entries, capture)
  if (decision.action === 'skip') return { entries, changed: 'skip' }

  const username = capture.username.trim()
  const url = capture.url.split('#')[0] || capture.url

  if (decision.action === 'update') {
    const prev = entries.find((entry) => entry.id === decision.entryId)
    if (!prev) return { entries, changed: 'skip' }
    const next: Entry = {
      ...prev,
      username: username || prev.username,
      password: capture.password,
      url: prev.url || url,
      urls: Array.from(new Set([...(prev.urls || []), url, prev.url].filter(Boolean))) as string[],
      lastUsedAt: now,
    }
    const saved = withCredentialHistory(prev, next)
    return {
      changed: 'update',
      entries: entries.map((entry) => (entry.id === saved.id ? saved : entry)),
    }
  }

  const created: Entry = {
    id: makeId(),
    type: 'login',
    name: loginTitleFromUrl(capture.url),
    username: username || undefined,
    password: capture.password,
    url,
    urls: [url],
    tags: [],
    favorite: false,
    customFields: [],
    history: [],
    createdAt: now,
    updatedAt: now,
    lastUsedAt: now,
    passwordChangedAt: now,
  }
  return { changed: 'create', entries: [created, ...entries] }
}

export function matchAppName(entries: Entry[], appName: string): Entry[] {
  const needle = appName.trim().toLowerCase()
  if (!needle) return []
  return entries.filter((entry) => {
    if (!entry.password && !entry.username) return false
    const hay = `${entry.appName || ''} ${entry.name}`.toLowerCase()
    return hay.includes(needle) || needle.includes((entry.appName || entry.name).trim().toLowerCase())
  })
}
