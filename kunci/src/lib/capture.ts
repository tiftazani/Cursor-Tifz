import type { Entry } from '../types'
import { DEFAULT_CLOUD_URL, LOCAL_APP_ORIGINS } from './allowed-origins'
import { entryMatchesPage, hostFromUrl, layerFromUrl } from './match'
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

/**
 * Whether this entry belongs to `host` on its own, ignoring its url history.
 * A capture on host X may only update an entry that lives on X.
 */
function samePrimaryHost(entry: Entry, host: string | null): boolean {
  if (!host) return true
  const own = hostFromUrl(entry.url || entry.urls?.[0] || '')
  return own === host
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

  // Identity comes from the entry's own host, never from its whole urls list.
  // urls is merge history, so a foreign url in there used to make an unrelated
  // entry look like "this page's login" and get overwritten by a save here.
  const siteLogins = entries.filter(
    (entry) => entry.type !== 'note' && entryMatchesPage(entry, capture.url) && samePrimaryHost(entry, host),
  )
  // One site can ask for a password in more than one place. Prefer entries saved
  // from this same path, or saving a payment PIN would overwrite the site login.
  const layer = layerFromUrl(capture.url)
  const sameLayer = siteLogins.filter((entry) => layerFromUrl(entry.url || entry.urls?.[0] || '') === layer)
  const candidates = sameLayer.length ? sameLayer : siteLogins
  const sameUser = candidates.filter((entry) => (entry.username || '').trim() === username)
  const pool = username ? sameUser : candidates
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
