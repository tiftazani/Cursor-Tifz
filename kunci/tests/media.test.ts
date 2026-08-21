import { describe, expect, it } from 'vitest'
import { COMPACT_NAV_QUERY, PHONE_QUERY } from '../src/lib/media'

describe('responsive breakpoints', () => {
  it('uses a single compact layout under 1100px so phones are not a squeezed desktop grid', () => {
    expect(PHONE_QUERY).toBe(COMPACT_NAV_QUERY)
    expect(COMPACT_NAV_QUERY).toContain('1100px')
  })
})
