import type { Entry } from '../types'
import { DEFAULT_CLOUD_URL, LOCAL_APP_ORIGINS } from './allowed-origins'
import { entryMatchesPage, hostFromUrl, layerFromUrl } from './match'
import { withCredentialHistory } from './history'
import { newId } from './id'
import { storedUrl } from './site'

export interface LoginCapture {
  url: string
  username: string
  password: string
  /** Which company/organisation this login belongs to, when the page asked for one. */
  tenant?: string
  /** True when the page carried a shared password and the tenant box was left empty. */
  missingTenant?: boolean
}

/**
 * The shared password stage. A site that asks for a company code and one password
 * every member uses, then a personal username and password, produces two saves.
 * The first would otherwise be stored as though it were a real login and sit in the
 * list forever as a near duplicate. The caller drops it when it recognises the shape.
 */
export function isSharedPasswordStage(capture: LoginCapture): boolean {
  return Boolean(capture.missingTenant)
}

export type SaveDecision = { action: 'skip'; reason: 'empty' | 'kunci-app' | 'unchanged' | 'shared-password' } | { action: 'create' } | { action: 'update'; entryId: string }

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
  // The shared stage is a step towards the real login, which is saved on the next
  // screen with a username. Saving this too would leave a near duplicate behind.
  if (isSharedPasswordStage(capture)) return { action: 'skip', reason: 'shared-password' }
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
  const tenant = (capture.tenant || '').trim()
  // The query string is dropped here, not at capture time: a login page carries one-time
  // material (`?ottoken=…` on agoda) that must not reach the vault, and keeping it made
  // `urls` grow by one on every login. See storedUrl in site.js.
  const url = storedUrl(capture.url)

  if (decision.action === 'update') {
    const prev = entries.find((entry) => entry.id === decision.entryId)
    if (!prev) return { entries, changed: 'skip' }
    const named = tenant && !entryTitleCovers(prev, tenant)
    // prev.url and prev.urls go through storedUrl too, so an entry that already carries a
    // one-time token from an earlier save is cleaned the next time it is used. Without
    // this, the old token would stay in the vault forever.
    const prevUrl = storedUrl(prev.url || '')
    const next: Entry = {
      ...prev,
      name: named ? `${prev.name} · ${tenant}` : prev.name,
      username: username || prev.username,
      password: capture.password,
      appName: tenant || prev.appName,
      url: prevUrl || url,
      urls: Array.from(new Set([...(prev.urls || []).map(storedUrl), url, prevUrl].filter(Boolean))) as string[],
      customFields: withTenantField(prev, tenant),
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
    name: tenant ? `${loginTitleFromUrl(capture.url)} · ${tenant}` : loginTitleFromUrl(capture.url),
    username: username || undefined,
    password: capture.password,
    appName: tenant || undefined,
    url,
    urls: [url],
    tags: [],
    favorite: false,
    customFields: tenant ? [{ id: makeId(), label: TENANT_LABEL, value: tenant, hidden: false }] : [],
    history: [],
    createdAt: now,
    updatedAt: now,
    lastUsedAt: now,
    passwordChangedAt: now,
  }
  return { changed: 'create', entries: [created, ...entries] }
}

export const TENANT_LABEL = 'Perusahaan'

/** Keep the company in a real field, so it is searchable and readable in the pane. */
function withTenantField(entry: Entry, tenant: string): Entry['customFields'] {
  const fields = entry.customFields || []
  if (!tenant) return fields
  const existing = fields.find((f) => (f.label || '').toLowerCase() === TENANT_LABEL.toLowerCase())
  if (existing) return fields.map((f) => (f.id === existing.id ? { ...f, value: tenant } : f))
  return [...fields, { id: `${entry.id}-tenant`, label: TENANT_LABEL, value: tenant, hidden: false }]
}

/** True when the entry's name already tells the user which company it belongs to. */
function entryTitleCovers(entry: Entry, tenant: string): boolean {
  return `${entry.name || ''} ${entry.appName || ''}`.toLowerCase().includes(tenant.toLowerCase())
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
