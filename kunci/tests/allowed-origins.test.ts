import { describe, expect, it } from 'vitest'
import { isAllowedKunciOrigin, LOCAL_APP_ORIGINS } from '../src/lib/allowed-origins'

describe('cloud origin allowlist', () => {
  it('allows the site host and local Kunci tabs', () => {
    expect(isAllowedKunciOrigin('https://kunci-tifta.netlify.app', 'kunci-tifta.netlify.app')).toBe(true)
    expect(isAllowedKunciOrigin('http://127.0.0.1:8780', 'kunci-tifta.netlify.app')).toBe(true)
    expect(isAllowedKunciOrigin('http://localhost:5173', 'kunci-tifta.netlify.app')).toBe(true)
    for (const origin of LOCAL_APP_ORIGINS) {
      expect(isAllowedKunciOrigin(origin, 'kunci-tifta.netlify.app')).toBe(true)
    }
  })

  it('rejects a random website', () => {
    expect(isAllowedKunciOrigin('https://evil.example', 'kunci-tifta.netlify.app')).toBe(false)
  })
})
