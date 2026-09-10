import { describe, expect, it, vi } from 'vitest'
import { pwnedCount, sha1Hex } from '../src/lib/hibp'

describe('hibp k-anonymity', () => {
  it('hashes with SHA-1', async () => {
    const hex = await sha1Hex('password')
    expect(hex).toBe('5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8')
  })

  it('only looks up the 5-character prefix', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe('https://api.pwnedpasswords.com/range/5BAA6')
      return new Response('1E4C9B93F3F0682250B6CF8331B7EE68FD8:333\nAAAA:1\n')
    })
    const count = await pwnedCount('password', fetchImpl as unknown as typeof fetch)
    expect(count).toBe(333)
  })
})
