import { describe, expect, it } from 'vitest'
import '../extension/ext-api.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('kunciNewId', () => {
  it('returns a uuid-shaped id without randomUUID', () => {
    const real = globalThis.crypto
    const stub = {
      getRandomValues(bytes) {
        for (let i = 0; i < bytes.length; i++) bytes[i] = i + 1
        return bytes
      },
    }
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: stub })
    try {
      expect(globalThis.kunciNewId()).toMatch(UUID)
    } finally {
      Object.defineProperty(globalThis, 'crypto', { configurable: true, value: real })
    }
  })

  it('does not throw when randomUUID exists but rejects insecure pages', () => {
    const real = globalThis.crypto
    const stub = {
      randomUUID() {
        throw new Error('Secure context required')
      },
      getRandomValues(bytes) {
        for (let i = 0; i < bytes.length; i++) bytes[i] = i + 1
        return bytes
      },
    }
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: stub })
    try {
      expect(() => globalThis.kunciNewId()).not.toThrow()
      expect(globalThis.kunciNewId()).toMatch(UUID)
    } finally {
      Object.defineProperty(globalThis, 'crypto', { configurable: true, value: real })
    }
  })
})
