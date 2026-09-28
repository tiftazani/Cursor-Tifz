import { isPublicSuffix, siteLabel, storedUrl } from './site.js'

function b64ToBytes(b64) {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToB64(bytes) {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

const KUNCI_PORTS = new Set(['8780', '5173', '4173'])

export function isKunciAppUrl(raw) {
  try {
    const url = new URL(raw)
    if (url.hostname === 'kunci.tiftazani-cuciin.workers.dev') return url.protocol === 'https:'
    // `http:` only. An https loopback server on one of these ports is a different
    // app that happens to reuse the port, and `src/lib/capture.ts` already says so.
    if (url.protocol !== 'http:') return false
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return KUNCI_PORTS.has(url.port || '80')
    return false
  } catch {
    return false
  }
}

export function hostFromUrl(raw) {
  try {
    const trimmed = String(raw ?? '').trim()
    if (!trimmed) return null
    const hasScheme = trimmed.includes('://')
    // Bare strings with "@" are account names, not hosts: "tiftazani@gmail.com"
    // would otherwise parse as host "gmail.com" and link unrelated entries.
    if (!hasScheme && (trimmed.includes(' ') || trimmed.includes('@') || /%[0-9a-f]{2}/i.test(trimmed))) return null
    const url = new URL(hasScheme ? trimmed : `https://${trimmed}`)
    return url.hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return null
  }
}

export function domainsMatch(a, b) {
  const ha = hostFromUrl(a)
  const hb = hostFromUrl(b)
  if (!ha || !hb) return false
  // A login saved over https must not be filled into the same host over plain http:
  // the password would go out unencrypted on submit. Mirrors src/lib/match.ts.
  if (/^https:\/\//i.test(String(a ?? '').trim()) && /^http:\/\//i.test(String(b ?? '').trim())) return false
  if (ha === hb) return true
  const shorter = ha.length <= hb.length ? ha : hb
  const longer = shorter === ha ? hb : ha
  // A bare label ("com", "co", "io") is not a site; only a dotted name may be a suffix.
  if (!shorter.includes('.')) return false
  if (!longer.endsWith(`.${shorter}`)) return false
  // One host ends with the other, but that only means the same site when the shorter one
  // is a real site rather than a shared suffix: `surge.sh` gives every customer a name
  // under it, so a login saved for `surge.sh` must not be offered on
  // `pelindo-kpi-monitoring.surge.sh`. Mirrors src/lib/match.ts.
  return !isPublicSuffix(shorter)
}

// A name is a label or a full domain, never a fragment. `name.includes(host)` let an
// entry named "notgmail.com" answer for gmail.com, and "gmail.com.evil.example"
// answer for gmail.com. A bare label matches only the label the host OWNS:
// `host.split('.').includes(token)` accepted "gmail" on gmail.evil.com, so an
// attacker's subdomain got the real password with no interaction. Mirrors
// src/lib/match.ts; tests/match-parity.test.ts guards it.
//
// siteLabel comes from site.js, which reads the real Public Suffix List. The hand-rolled
// version this replaced took the last two labels, which called
// `pelindo-kpi-monitoring.surge.sh` a subdomain of `surge.sh` and offered one Surge
// customer's login on another customer's page.
function nameMatchesHost(name, host) {
  if (!name || !host) return false
  if (name.includes('@')) return false
  const token = name.replace(/\s+/g, '').replace(/^www\./, '')
  if (!token) return false
  if (token === host) return true
  // Only when the name is a real site: a name that is itself a public suffix
  // ("surge.sh", "github.io") covers every customer beneath it.
  if (token.includes('.') && !isPublicSuffix(token) && host.endsWith(`.${token}`)) return true
  return siteLabel(host) === token
}

/**
 * What the popup may show. Without a query it is exactly the entries saved for this
 * site, never the whole vault: the old fallback dumped 12 unrelated passwords into
 * the popup on any site with no saved login.
 */
export function entriesToOffer({ query, siteMatches, searchedEntries }) {
  return query ? searchedEntries : siteMatches
}

export function emptyListMessage({ hasUrl, query }) {
  if (query) return 'Tidak ada hasil'
  if (hasUrl) return 'Belum ada login tersimpan untuk situs ini'
  return 'Buka tab situs, atau ketik untuk mencari'
}

/**
 * The URL path an entry was saved from: which prompt of a site it belongs to.
 * One host can ask for a password in more than one place (site login, then a
 * transfer or payment PIN); those are separate credentials for the same site.
 */
export function layerFromUrl(raw) {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return ''
  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
    return url.pathname.replace(/\/+$/, '').toLowerCase()
  } catch {
    return ''
  }
}

// ponytail: Chrome loads extension/ as plain JS, so this mirrors src/lib/match.ts.
// tests/match-parity.test.ts fails if the two copies drift.
export function matchesForUrl(entries, pageUrl) {
  const pageLayer = layerFromUrl(pageUrl)
  const rank = (e) => {
    const layer = layerFromUrl(e.url || (e.urls || [])[0] || '')
    if (layer && pageLayer && layer === pageLayer) return 0
    if (!layer || layer === '/') return 1
    return 2
  }
  return (entries || [])
    .filter((e) => {
      if (e.type === 'note') return false
      const urls = [e.url, ...(e.urls || [])].filter(Boolean)
      if (urls.some((u) => domainsMatch(u, pageUrl))) return true
      const host = hostFromUrl(pageUrl)
      if (!host) return false
      const name = (e.name || '').toLowerCase()
      const app = (e.appName || '').toLowerCase()
      return nameMatchesHost(name, host) || nameMatchesHost(app, host)
    })
    // The entry saved from THIS path is the one the user wants at this prompt; the
    // site-root login is the fallback. Never hide a match, only order them.
    .map((e, i) => [e, rank(e), i])
    .sort((a, b) => a[1] - b[1] || a[2] - b[2])
    .map(([e]) => e)
}

export function loginTitleFromUrl(raw) {
  const host = hostFromUrl(raw)
  if (!host) return 'Login'
  const label = host.split('.')[0] || host
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Mirrors samePrimaryHost in src/lib/capture.ts. */
function samePrimaryHost(entry, host) {
  if (!host) return true
  const own = hostFromUrl(entry.url || (entry.urls || [])[0] || '')
  return own === host
}

export function decideLoginSave(entries, capture, neverHosts = []) {
  const username = (capture.username || '').trim()
  const password = capture.password || ''
  if (!password) return { action: 'skip', reason: 'empty' }
  // Mirrors isSharedPasswordStage in src/lib/capture.ts: the shared stage is a step
  // towards the real login, saved on the next screen with a username.
  if (capture.missingTenant) return { action: 'skip', reason: 'shared-password' }
  if (isKunciAppUrl(capture.url)) return { action: 'skip', reason: 'kunci-app' }
  const host = hostFromUrl(capture.url)
  if (host && neverHosts.includes(host)) return { action: 'skip', reason: 'never' }
  // Mirrors decideLoginSave in src/lib/capture.ts: identity comes from the
  // entry's own host, never from its whole urls list.
  const siteLogins = (entries || []).filter(
    (e) => e.type !== 'note' && matchesForUrl([e], capture.url).length && samePrimaryHost(e, host),
  )
  // One site can ask for a password in more than one place. Prefer entries saved
  // from this same path, or saving a payment PIN would overwrite the site login.
  const layer = layerFromUrl(capture.url)
  const sameLayer = siteLogins.filter((e) => layerFromUrl(e.url || (e.urls || [])[0] || '') === layer)
  const candidates = sameLayer.length ? sameLayer : siteLogins
  const sameUser = candidates.filter((e) => (e.username || '').trim() === username)
  const pool = username ? sameUser : candidates
  if (pool.find((e) => (e.password || '') === password && (e.username || '').trim() === username)) {
    return { action: 'skip', reason: 'unchanged' }
  }
  if (pool.length === 1) return { action: 'update', entryId: pool[0].id, existing: pool[0] }
  if (sameUser.length === 1) return { action: 'update', entryId: sameUser[0].id, existing: sameUser[0] }
  return { action: 'create' }
}

function newEntryId() {
  try {
    if (typeof globalThis.kunciNewId === 'function') return globalThis.kunciNewId()
  } catch {
    /* ignore */
  }
  try {
    return crypto.randomUUID()
  } catch {
    return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
  }
}

const TENANT_LABEL = 'Perusahaan'
const TENANT_ID = 'kunci-tenant-field'

/** True when the entry's name already tells the user which company it belongs to. */
function tenantTitleCovers(entry, tenant) {
  return `${entry.name || ''} ${entry.appName || ''}`.toLowerCase().includes(tenant.toLowerCase())
}

/**
 * Keep the company in a real field, so it is searchable and readable in the pane.
 *
 * Mirrors withTenantField in src/lib/capture.ts. The id is fixed rather than derived
 * from the entry id, so updating an entry does not leave a second company field behind.
 */
function withTenantField(entry, tenant, now) {
  const fields = entry.customFields || []
  if (!tenant) return fields
  const existing = fields.find(
    (f) => (f.label || '').toLowerCase() === TENANT_LABEL.toLowerCase() || f.id === TENANT_ID,
  )
  if (existing) return fields.map((f) => (f.id === existing.id ? { ...f, value: tenant } : f))
  return [...fields, { id: TENANT_ID, label: TENANT_LABEL, value: tenant, hidden: false, createdAt: now }]
}

export function applyLoginCapture(entries, capture, now = Date.now()) {
  const decision = decideLoginSave(entries, capture)
  if (decision.action === 'skip') return { entries, changed: 'skip', decision }
  const username = (capture.username || '').trim()
  const tenant = (capture.tenant || '').trim()
  // The query string is dropped here, not at capture time: a login page carries one-time
  // material (`?ottoken=…` on agoda) that must not reach the vault, and keeping it made
  // `urls` grow by one on every login. See storedUrl in site.js.
  const url = storedUrl(capture.url)
  if (decision.action === 'update') {
    const prev = entries.find((e) => e.id === decision.entryId)
    if (!prev) return { entries, changed: 'skip', decision }
    const history =
      (prev.password || '') !== capture.password || (prev.username || '') !== username
        ? [{ id: newEntryId(), username: prev.username, password: prev.password, changedAt: now }, ...(prev.history || [])].slice(0, 50)
        : prev.history || []
    const named = tenant && !tenantTitleCovers(prev, tenant)
    // prev.url and prev.urls go through storedUrl too, so an entry that already carries a
    // one-time token from an earlier save is cleaned the next time it is used. Without
    // this, the old token would stay in the vault forever.
    const prevUrl = storedUrl(prev.url || '')
    const saved = {
      ...prev,
      name: named ? `${prev.name} · ${tenant}` : prev.name,
      username: username || prev.username,
      password: capture.password,
      appName: tenant || prev.appName,
      url: prevUrl || url,
      urls: [...new Set([...(prev.urls || []).map(storedUrl), url, prevUrl].filter(Boolean))],
      customFields: withTenantField(prev, tenant, now),
      history,
      updatedAt: now,
      lastUsedAt: now,
      passwordChangedAt: (prev.password || '') !== capture.password ? now : prev.passwordChangedAt,
    }
    return {
      changed: 'update',
      decision,
      entries: entries.map((e) => (e.id === saved.id ? saved : e)),
    }
  }
  const customFields = withTenantField({ customFields: [] }, tenant, now)
  const created = {
    id: newEntryId(),
    type: 'login',
    name: tenant ? `${loginTitleFromUrl(capture.url)} · ${tenant}` : loginTitleFromUrl(capture.url),
    username: username || undefined,
    password: capture.password,
    appName: tenant || undefined,
    url,
    urls: [url],
    tags: [],
    favorite: false,
    customFields,
    history: [],
    createdAt: now,
    updatedAt: now,
    lastUsedAt: now,
    passwordChangedAt: now,
  }
  return { changed: 'create', decision, entries: [created, ...entries] }
}

export async function decryptVault(blob, password) {
  const salt = b64ToBytes(blob.salt)
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  const kek = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: blob.iter, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )
  let vaultKey = kek
  let dekRaw = new Uint8Array(await crypto.subtle.exportKey('raw', kek))
  if (blob.v === 2 && blob.wrap && blob.wrapIv) {
    const wrapIv = b64ToBytes(blob.wrapIv)
    const wrap = b64ToBytes(blob.wrap)
    dekRaw = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: wrapIv }, kek, wrap))
    vaultKey = await crypto.subtle.importKey('raw', dekRaw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
  }
  const iv = b64ToBytes(blob.iv)
  const data = b64ToBytes(blob.data)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, vaultKey, data)
  return { vault: JSON.parse(new TextDecoder().decode(plain)), dekRaw }
}

export async function persistVault(vault, dekRaw, blob) {
  const dek = await crypto.subtle.importKey('raw', dekRaw, { name: 'AES-GCM' }, false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, dek, new TextEncoder().encode(JSON.stringify(vault)))
  return { ...blob, iv: bytesToB64(iv), data: bytesToB64(new Uint8Array(cipher)), savedAt: Date.now() }
}

export async function decryptWithDek(blob, dekRaw) {
  const dek = await crypto.subtle.importKey('raw', dekRaw, { name: 'AES-GCM' }, false, ['decrypt'])
  const iv = b64ToBytes(blob.iv)
  const data = b64ToBytes(blob.data)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, dek, data)
  return JSON.parse(new TextDecoder().decode(plain))
}

export function dekToB64(dekRaw) {
  return bytesToB64(dekRaw)
}

export function dekFromB64(b64) {
  return b64ToBytes(b64)
}

export function isEncryptedBlob(value) {
  if (!value || typeof value !== 'object') return false
  return (value.v === 1 || value.v === 2) && typeof value.salt === 'string' && typeof value.data === 'string'
}

export function unlockErrorMessage(err) {
  const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : ''
  const msg = err instanceof Error ? err.message : String(err || '')
  if (!msg.trim() || name === 'OperationError' || /operationerror/i.test(msg)) {
    return 'Kata sandi induk salah'
  }
  return msg
}
