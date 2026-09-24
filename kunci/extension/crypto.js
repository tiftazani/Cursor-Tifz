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
    if (url.hostname === 'kunci.tiftazani-cuciin.workers.dev') return true
    if ((url.hostname === '127.0.0.1' || url.hostname === 'localhost') && KUNCI_PORTS.has(url.port || '80')) return true
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
  if (ha === hb) return true
  const shorter = ha.length <= hb.length ? ha : hb
  const longer = shorter === ha ? hb : ha
  // A bare label ("com", "co", "io") is not a site; only a dotted name may be a suffix.
  if (!shorter.includes('.')) return false
  return longer.endsWith(`.${shorter}`)
}

function nameMatchesHost(name, host) {
  if (!name || !host) return false
  // A name holding an account ("tiftazani@gmail.com") is an account, not a site
  // label. Without this, "gmail.com" leaks out of the address itself and the entry
  // is offered on gmail.com wherever it is opened.
  if (name.includes('@')) return false
  if (name.includes(host)) return true
  const token = name.replace(/\s+/g, '')
  if (token.length < 4) return false
  return host.split('.').includes(token)
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
      return nameMatchesHost(name, host)
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

export function decideLoginSave(entries, capture, neverHosts = []) {
  const username = (capture.username || '').trim()
  const password = capture.password || ''
  if (!password) return { action: 'skip', reason: 'empty' }
  if (isKunciAppUrl(capture.url)) return { action: 'skip', reason: 'kunci-app' }
  const host = hostFromUrl(capture.url)
  if (host && neverHosts.includes(host)) return { action: 'skip', reason: 'never' }
  const siteLogins = (entries || []).filter((e) => e.type !== 'note' && matchesForUrl([e], capture.url).length)
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

export function applyLoginCapture(entries, capture, now = Date.now()) {
  const decision = decideLoginSave(entries, capture)
  if (decision.action === 'skip') return { entries, changed: 'skip', decision }
  const username = (capture.username || '').trim()
  const url = (capture.url || '').split('#')[0]
  if (decision.action === 'update') {
    const prev = entries.find((e) => e.id === decision.entryId)
    if (!prev) return { entries, changed: 'skip', decision }
    const history =
      (prev.password || '') !== capture.password || (prev.username || '') !== username
        ? [{ id: newEntryId(), username: prev.username, password: prev.password, changedAt: now }, ...(prev.history || [])].slice(0, 50)
        : prev.history || []
    const saved = {
      ...prev,
      username: username || prev.username,
      password: capture.password,
      url: prev.url || url,
      urls: [...new Set([...(prev.urls || []), url, prev.url].filter(Boolean))],
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
  const created = {
    id: newEntryId(),
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
