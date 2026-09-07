import { describe, expect, it } from 'vitest'
import '../extension/ext-api.js'

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
      const id = globalThis.kunciNewId()
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    } finally {
      Object.defineProperty(globalThis, 'crypto', { configurable: true, value: real })
    }
  })
})
