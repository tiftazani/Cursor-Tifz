export const OTP_REUSE_MS = 2 * 60 * 1000
export const OTP_TTL_MS = 10 * 60 * 1000
export const OTP_SEND_COOLDOWN_MS = 90 * 1000
export const OTP_MAX_ATTEMPTS = 5
export const OTP_SENT_AT_KEY = 'kunci_otp_sent_at'

export type StoredOtp = {
  hash: string
  salt: string
  exp: number
  attempts: number
  issuedAt?: number
}

export type OtpSendPlan = 'reuse' | 'rate_limit' | 'send'

export function otpIssuedAt(otp: StoredOtp): number {
  if (typeof otp.issuedAt === 'number' && Number.isFinite(otp.issuedAt)) return otp.issuedAt
  return otp.exp - OTP_TTL_MS
}

export function shouldReuseOtp(otp: StoredOtp | null | undefined, now: number): boolean {
  if (!otp) return false
  if (now > otp.exp) return false
  if (otp.attempts >= OTP_MAX_ATTEMPTS) return false
  return now - otpIssuedAt(otp) < OTP_REUSE_MS
}

/** Urutan wajib: cek reuse dulu. Rate-limit kirim email hanya kalau OTP baru memang akan dibuat. */
export function planOtpSend(otp: StoredOtp | null | undefined, now: number, emailRateOk: boolean): OtpSendPlan {
  if (shouldReuseOtp(otp, now)) return 'reuse'
  if (!emailRateOk) return 'rate_limit'
  return 'send'
}

export function otpSendCooldownRemaining(sentAt: number | null | undefined, now: number): number {
  if (sentAt == null || !Number.isFinite(sentAt)) return 0
  return Math.max(0, sentAt + OTP_SEND_COOLDOWN_MS - now)
}
