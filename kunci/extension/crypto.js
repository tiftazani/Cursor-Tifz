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
    if (url.hostname === 'kunci-tifta.netlify.app') return true
    if ((url.hostname === '127.0.0.1' || url.hostname === 'localhost') && KUNCI_PORTS.has(url.port || '80')) return true
    return false
  } catch {
    return false
  }
}

export function hostFromUrl(raw) {
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`)
    return url.hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return null
  }
}

export function domainsMatch(a, b) {
  const ha = hostFromUrl(a)
  const hb = hostFromUrl(b)
  if (!ha || !hb) return false
  return ha === hb || hb.endsWith(`.${ha}`) || ha.endsWith(`.${hb}`)
}

export function matchesForUrl(entries, pageUrl) {
  return (entries || []).filter((e) => {
    if (e.type === 'note') return false
    const urls = [e.url, ...(e.urls || [])].filter(Boolean)
    if (urls.some((u) => domainsMatch(u, pageUrl))) return true
    const host = hostFromUrl(pageUrl)
    if (!host) return false
    const name = (e.name || '').toLowerCase()
    return name.includes(host) || host.includes(name.replace(/\s+/g, ''))
  })
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
  const sameUser = siteLogins.filter((e) => (e.username || '').trim() === username)
  const pool = username ? sameUser : siteLogins
  if (pool.find((e) => (e.password || '') === password && (e.username || '').trim() === username)) {
    return { action: 'skip', reason: 'unchanged' }
  }
  if (pool.length === 1) return { action: 'update', entryId: pool[0].id, existing: pool[0] }
  if (sameUser.length === 1) return { action: 'update', entryId: sameUser[0].id, existing: sameUser[0] }
  return { action: 'create' }
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
        ? [{ id: crypto.randomUUID(), username: prev.username, password: prev.password, changedAt: now }, ...(prev.history || [])].slice(0, 50)
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
    id: crypto.randomUUID(),
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
