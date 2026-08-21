import { describe, expect, it } from 'vitest'
import { COMPACT_MAX_PX, COMPACT_NAV_QUERY, PHONE_QUERY } from '../src/lib/media'

describe('responsive breakpoints', () => {
  it('uses a single compact layout under 1100px so phones are not a squeezed desktop grid', () => {
    expect(PHONE_QUERY).toBe(COMPACT_NAV_QUERY)
    expect(COMPACT_NAV_QUERY).toBe(`(max-width: ${COMPACT_MAX_PX}px)`)
    expect(COMPACT_MAX_PX).toBe(1100)
  })
})
