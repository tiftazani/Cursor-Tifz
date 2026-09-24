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

  it('never turns a long legacy timeout into "never lock"', () => {
    // autoLockMinutes was a free number box up to 120. Anything past 5 minutes
    // used to snap to AUTO_LOCK_NEVER, so a vault set to "10 minutes" quietly
    // stopped locking itself. Only an explicit 0 means never.
    expect(resolveAutoLockSeconds({ autoLockMinutes: 10 })).toBe(300)
    expect(resolveAutoLockSeconds({ autoLockMinutes: 30 })).toBe(300)
    expect(resolveAutoLockSeconds({ autoLockMinutes: 60 })).toBe(300)
    expect(resolveAutoLockSeconds({ autoLockMinutes: 120 })).toBe(300)
    expect(resolveAutoLockSeconds({ autoLockSeconds: 900 })).toBe(300)
  })
})
