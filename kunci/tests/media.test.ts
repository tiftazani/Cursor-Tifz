import { describe, expect, it } from 'vitest'
import { COMPACT_NAV_QUERY, PHONE_QUERY } from '../src/lib/media'

describe('responsive breakpoints', () => {
  it('treats phones as a single-pane layout and tablets as compact navigation', () => {
    expect(PHONE_QUERY).toContain('700px')
    expect(COMPACT_NAV_QUERY).toContain('1100px')
  })
})
