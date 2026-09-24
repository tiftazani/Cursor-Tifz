import { describe, expect, it } from 'vitest'
import { analyzeHealth } from '../src/lib/health'
import { isCommonPassword, isStrongMaster, passwordStrength } from '../src/lib/strength'
import type { Entry } from '../src/types'

function entry(id: string, password: string, extra: Partial<Entry> = {}): Entry {
  return {
    id,
    type: 'login',
    name: id,
    password,
    urls: [],
    tags: [],
    favorite: false,
    customFields: [],
    history: [],
    createdAt: 1,
    updatedAt: 1,
    passwordChangedAt: 1,
    ...extra,
  }
}

describe('strength and health', () => {
  it('scores common passwords as weak', () => {
    expect(passwordStrength('password').score).toBeLessThan(2)
    expect(isStrongMaster('password')).toBe(false)
    expect(isStrongMaster('Tr0pical-Mangrove-2026')).toBe(true)
  })

  it('does not call a long password common just because it contains a common word', () => {
    // `lowered.includes('password')` flagged "MyPasswordIsLong-2026!" as commonly used,
    // which cost it two points and a scary reason. 23 characters with four classes is
    // not a leaked password.
    const long = passwordStrength('MyPasswordIsLong-2026!')
    expect(long.reasons).not.toContain('Termasuk kata sandi yang umum dipakai')
    expect(long.score).toBe(4)

    const business = passwordStrength('MonkeyBusiness-2026!')
    expect(business.reasons).not.toContain('Termasuk kata sandi yang umum dipakai')
    expect(business.score).toBe(4)
  })

  it('still flags a common word that is most of the password', () => {
    for (const p of ['password123', 'monkey123', 'iloveyou', 'jakarta2026', 'qwerty']) {
      expect(passwordStrength(p).reasons, p).toContain('Termasuk kata sandi yang umum dipakai')
    }
  })

  it('isCommonPassword is exact for a real match and length-guarded otherwise', () => {
    expect(isCommonPassword('password')).toBe(true)
    expect(isCommonPassword('PASSWORD')).toBe(true)
    expect(isCommonPassword('password123')).toBe(true)
    expect(isCommonPassword('MyPasswordIsLong-2026!')).toBe(false)
    expect(isCommonPassword('TotallyUnrelated-2026')).toBe(false)
  })

  it('flags reused, weak, and old passwords', () => {
    const now = 1_800_000_000_000
    const report = analyzeHealth(
      [
        entry('a', '123456'),
        entry('b', '123456'),
        entry('c', 'Tr0pical-Mangrove-2026!!', { passwordChangedAt: 1, updatedAt: 1 }),
      ],
      now,
    )
    expect(report.reused).toBeGreaterThan(0)
    expect(report.weak).toBeGreaterThan(0)
    expect(report.old).toBeGreaterThan(0)
    expect(report.score).toBeLessThan(100)
  })
})
