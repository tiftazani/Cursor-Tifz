const COMMON = [
  'password',
  'password1',
  'passw0rd',
  '123456',
  '12345678',
  '123456789',
  'qwerty',
  'abc123',
  'letmein',
  'welcome',
  'admin',
  'iloveyou',
  'monkey',
  'dragon',
  'master',
  'login',
  'princess',
  'sunshine',
  'football',
  'baseball',
  'indonesia',
  'jakarta',
  'qwerty123',
]

export interface StrengthResult {
  score: 0 | 1 | 2 | 3 | 4
  label: string
  reasons: string[]
}

/**
 * Whether the password is built from a commonly leaked one.
 *
 * An exact match is always a hit. A substring only counts when the common word makes
 * up most of the password: `monkey` inside `monkey123` is the whole password plus a
 * tail, but `password` inside `MyPasswordIsLong-2026!` is 8 characters of a 23
 * character password, and calling that "commonly used" is wrong. Length is the guard
 * because the score already rewards it.
 */
export function isCommonPassword(password: string): boolean {
  const p = password.toLowerCase()
  return COMMON.some((c) => {
    if (p === c) return true
    if (!p.includes(c)) return false
    return c.length * 2 >= p.length
  })
}

export function passwordStrength(password: string): StrengthResult {
  const reasons: string[] = []
  if (!password) return { score: 0, label: 'Kosong', reasons: ['Belum ada kata sandi'] }

  const length = password.length
  const lower = /[a-z]/.test(password)
  const upper = /[A-Z]/.test(password)
  const digit = /\d/.test(password)
  const symbol = /[^A-Za-z0-9]/.test(password)
  const classes = [lower, upper, digit, symbol].filter(Boolean).length

  let score = 0
  if (length >= 8) score += 1
  if (length >= 12) score += 1
  if (length >= 16) score += 1
  if (classes >= 3) score += 1
  if (classes === 4 && length >= 14) score += 1

  if (length < 8) reasons.push('Terlalu pendek (min. 8, disarankan 16+)')
  if (classes < 3) reasons.push('Campur huruf besar, kecil, angka, dan simbol')
  if (/^[A-Za-z]+$/.test(password)) reasons.push('Hanya huruf')
  if (/^\d+$/.test(password)) reasons.push('Hanya angka')
  if (/(.)\1{2,}/.test(password)) reasons.push('Ada karakter berulang')
  if (/0123|1234|2345|abcd|qwer|asdf/i.test(password)) reasons.push('Pola berurutan terdeteksi')

  const lowered = password.toLowerCase()
  if (isCommonPassword(lowered)) {
    reasons.push('Termasuk kata sandi yang umum dipakai')
    score -= 2
  }

  if (reasons.length >= 2) score = Math.min(score, 2)
  if (length >= 20 && classes >= 3 && reasons.length === 0) score = 4
  const clamped = Math.max(0, Math.min(4, score)) as StrengthResult['score']
  const label = (['Sangat lemah', 'Lemah', 'Cukup', 'Kuat', 'Sangat kuat'] as const)[clamped]
  return { score: clamped, label, reasons }
}

export function isStrongMaster(password: string): boolean {
  const s = passwordStrength(password)
  return password.length >= 12 && s.score >= 3
}
