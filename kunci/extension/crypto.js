function b64ToBytes(b64) {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function decryptVault(blob, password) {
  const salt = b64ToBytes(blob.salt)
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  const kek = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: blob.iter, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  )
  let vaultKey = kek
  if (blob.v === 2 && blob.wrap && blob.wrapIv) {
    const wrapIv = b64ToBytes(blob.wrapIv)
    const wrap = b64ToBytes(blob.wrap)
    const dekRaw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: wrapIv }, kek, wrap)
    vaultKey = await crypto.subtle.importKey('raw', dekRaw, { name: 'AES-GCM' }, false, ['decrypt'])
  }
  const iv = b64ToBytes(blob.iv)
  const data = b64ToBytes(blob.data)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, vaultKey, data)
  return JSON.parse(new TextDecoder().decode(plain))
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
