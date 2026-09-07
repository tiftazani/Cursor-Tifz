import { describe, expect, it } from 'vitest'
import { decodeBase32, hotp, parseOtpauth, totpCode } from '../src/lib/totp'

describe('totp', () => {
  it('decodes RFC 4648 base32', () => {
    const bytes = decodeBase32('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
    expect(new TextDecoder().decode(bytes)).toBe('12345678901234567890')
  })

  it('matches RFC 4226 HOTP test vector', async () => {
    const secret = decodeBase32('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
    expect(await hotp(secret, 0)).toBe('755224')
    expect(await hotp(secret, 1)).toBe('287082')
  })

  it('produces a 6-digit TOTP that rotates with the period', async () => {
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
    const a = await totpCode(secret, 59_000)
    const b = await totpCode(secret, 89_000)
    expect(a.code).toBe('287082')
    expect(a.remaining).toBeGreaterThan(0)
    expect(b.code).not.toBe(a.code)
  })

  it('parses otpauth URIs', () => {
    const parsed = parseOtpauth('otpauth://totp/Kunci:tif@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Kunci')
    expect(parsed?.secret).toBe('JBSWY3DPEHPK3PXP')
    expect(parsed?.issuer).toBe('Kunci')
  })
})
