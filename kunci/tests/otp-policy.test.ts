import { describe, expect, it } from 'vitest'
import {
  OTP_MAX_ATTEMPTS,
  OTP_REUSE_MS,
  OTP_SEND_COOLDOWN_MS,
  OTP_TTL_MS,
  planOtpSend,
  otpSendCooldownRemaining,
  shouldReuseOtp,
  type StoredOtp,
} from '../src/lib/otp-policy'

function otp(partial: Partial<StoredOtp> & Pick<StoredOtp, 'issuedAt' | 'exp'>): StoredOtp {
  return {
    hash: 'x',
    salt: 'y',
    attempts: 0,
    ...partial,
  }
}

describe('shouldReuseOtp', () => {
  const now = 1_800_000_000_000

  it('rejects a missing or expired code', () => {
    expect(shouldReuseOtp(null, now)).toBe(false)
    expect(shouldReuseOtp(undefined, now)).toBe(false)
    expect(shouldReuseOtp(otp({ issuedAt: now - 1_000, exp: now - 1 }), now)).toBe(false)
  })

  it('reuses a live code issued within 2 minutes', () => {
    expect(
      shouldReuseOtp(
        otp({ issuedAt: now - OTP_REUSE_MS + 1, exp: now - OTP_REUSE_MS + 1 + OTP_TTL_MS }),
        now,
      ),
    ).toBe(true)
    expect(
      shouldReuseOtp(
        otp({ issuedAt: now - 30_000, exp: now - 30_000 + OTP_TTL_MS, attempts: 2 }),
        now,
      ),
    ).toBe(true)
  })

  it('issues a new code after the 2 minute reuse window even if TTL remains', () => {
    expect(
      shouldReuseOtp(
        otp({ issuedAt: now - OTP_REUSE_MS, exp: now - OTP_REUSE_MS + OTP_TTL_MS }),
        now,
      ),
    ).toBe(false)
  })

  it('does not reuse after too many verify attempts', () => {
    expect(
      shouldReuseOtp(
        otp({
          issuedAt: now - 10_000,
          exp: now + OTP_TTL_MS,
          attempts: OTP_MAX_ATTEMPTS,
        }),
        now,
      ),
    ).toBe(false)
  })

  it('infers issuedAt from exp - TTL when the field is missing', () => {
    const live = otp({ exp: now + OTP_TTL_MS - 20_000, issuedAt: undefined })
    delete live.issuedAt
    expect(shouldReuseOtp(live, now)).toBe(true)

    const stale = otp({ exp: now + 60_000, issuedAt: undefined })
    delete stale.issuedAt
    expect(shouldReuseOtp(stale, now)).toBe(false)
  })
})

describe('planOtpSend', () => {
  const now = 1_800_000_000_000
  const live = otp({ issuedAt: now - 15_000, exp: now - 15_000 + OTP_TTL_MS })

  it('reuses before consulting the email rate limit so dual localhost/HTTPS hits do not send twice', () => {
    expect(planOtpSend(live, now, false)).toBe('reuse')
    expect(planOtpSend(live, now, true)).toBe('reuse')
  })

  it('rate-limits sending only after reuse is ruled out', () => {
    expect(planOtpSend(null, now, false)).toBe('rate_limit')
    expect(planOtpSend(null, now, true)).toBe('send')
    expect(
      planOtpSend(
        otp({ issuedAt: now - OTP_REUSE_MS, exp: now - OTP_REUSE_MS + OTP_TTL_MS }),
        now,
        false,
      ),
    ).toBe('rate_limit')
    expect(
      planOtpSend(
        otp({ issuedAt: now - OTP_REUSE_MS, exp: now - OTP_REUSE_MS + OTP_TTL_MS }),
        now,
        true,
      ),
    ).toBe('send')
  })
})

describe('otpSendCooldownRemaining', () => {
  const now = 1_800_000_000_000

  it('locks AuthGate for 90 seconds after a successful send', () => {
    expect(otpSendCooldownRemaining(null, now)).toBe(0)
    expect(otpSendCooldownRemaining(now, now)).toBe(OTP_SEND_COOLDOWN_MS)
    expect(otpSendCooldownRemaining(now - 30_000, now)).toBe(60_000)
    expect(otpSendCooldownRemaining(now - OTP_SEND_COOLDOWN_MS, now)).toBe(0)
    expect(otpSendCooldownRemaining(now - OTP_SEND_COOLDOWN_MS - 1, now)).toBe(0)
  })
})
