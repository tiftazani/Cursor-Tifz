import { describe, expect, it } from 'vitest'
import { analyzeHealth } from '../src/lib/health'
import { isStrongMaster, passwordStrength } from '../src/lib/strength'
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
