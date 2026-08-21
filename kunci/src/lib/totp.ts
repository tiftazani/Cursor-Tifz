const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function normalizeSecret(secret: string): string {
  return secret.replace(/[\s-]/g, '').toUpperCase().replace(/[=]+$/, '')
}

export function decodeBase32(secret: string): Uint8Array {
  const clean = normalizeSecret(secret)
  if (!clean) throw new Error('Rahasia TOTP kosong')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch)
    if (idx < 0) throw new Error('Rahasia TOTP tidak valid')
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return new Uint8Array(out)
}

function counterBytes(counter: number): Uint8Array {
  const buf = new Uint8Array(8)
  const view = new DataView(buf.buffer)
  const n = BigInt(Math.floor(counter))
  view.setUint32(0, Number((n >> 32n) & 0xffffffffn))
  view.setUint32(4, Number(n & 0xffffffffn))
  return buf
}

export async function hotp(secret: Uint8Array, counter: number, digits = 6): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    secret as BufferSource,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const mac = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, counterBytes(counter) as BufferSource),
  )
  const offset = mac[mac.length - 1]! & 0x0f
  const bin =
    ((mac[offset]! & 0x7f) << 24) |
    ((mac[offset + 1]! & 0xff) << 16) |
    ((mac[offset + 2]! & 0xff) << 8) |
    (mac[offset + 3]! & 0xff)
  const otp = bin % 10 ** digits
  return otp.toString().padStart(digits, '0')
}

export async function totpCode(
  secret: string,
  now: number = Date.now(),
  period = 30,
  digits = 6,
): Promise<{ code: string; remaining: number; period: number }> {
  const counter = Math.floor(now / 1000 / period)
  const remaining = period - (Math.floor(now / 1000) % period)
  const code = await hotp(decodeBase32(secret), counter, digits)
  return { code, remaining, period }
}

export function parseOtpauth(uri: string): { secret: string; label: string; issuer?: string } | null {
  try {
    const url = new URL(uri)
    if (url.protocol !== 'otpauth:') return null
    const secret = url.searchParams.get('secret')
    if (!secret) return null
    const label = decodeURIComponent(url.pathname.replace(/^\//, ''))
    return { secret, label, issuer: url.searchParams.get('issuer') ?? undefined }
  } catch {
    return null
  }
}

export function looksLikeTotpSecret(value: string): boolean {
  const clean = normalizeSecret(value)
  return clean.length >= 8 && /^[A-Z2-7]+$/.test(clean)
}
