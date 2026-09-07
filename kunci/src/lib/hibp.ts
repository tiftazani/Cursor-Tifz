import { bytesToHex, utf8 } from './encoding'

export async function sha1Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', utf8(text) as BufferSource)
  return bytesToHex(new Uint8Array(digest)).toUpperCase()
}

export async function pwnedCount(password: string, fetchImpl: typeof fetch = fetch): Promise<number> {
  if (!password) return 0
  const hex = await sha1Hex(password)
  const prefix = hex.slice(0, 5)
  const suffix = hex.slice(5)
  const res = await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { 'Add-Padding': 'true' },
  })
  if (!res.ok) throw new Error('Gagal menghubungi Have I Been Pwned')
  const body = await res.text()
  for (const line of body.split('\n')) {
    const [hash, count] = line.trim().split(':')
    if (hash === suffix) return Number(count)
  }
  return 0
}
