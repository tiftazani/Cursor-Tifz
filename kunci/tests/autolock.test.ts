import { describe, expect, it } from 'vitest'
import { AUTO_LOCK_IMMEDIATE, AUTO_LOCK_NEVER, resolveAutoLockSeconds } from '../src/lib/autolock'

describe('auto-lock duration', () => {
  it('uses the new seconds field when present', () => {
    expect(resolveAutoLockSeconds({ autoLockSeconds: 15 })).toBe(15)
    expect(resolveAutoLockSeconds({ autoLockSeconds: AUTO_LOCK_NEVER })).toBe(AUTO_LOCK_NEVER)
    expect(resolveAutoLockSeconds({ autoLockSeconds: AUTO_LOCK_IMMEDIATE })).toBe(AUTO_LOCK_IMMEDIATE)
  })

  it('migrates the old minutes field (0 meant never)', () => {
    expect(resolveAutoLockSeconds({ autoLockMinutes: 0 })).toBe(AUTO_LOCK_NEVER)
    expect(resolveAutoLockSeconds({ autoLockMinutes: 1 })).toBe(60)
    expect(resolveAutoLockSeconds({ autoLockMinutes: 5 })).toBe(300)
    expect(resolveAutoLockSeconds({})).toBe(300)
  })
})
