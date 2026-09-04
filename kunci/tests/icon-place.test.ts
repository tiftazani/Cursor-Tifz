import { describe, expect, it } from 'vitest'
import '../extension/icon-place.js'

const { iconPosition, overlaps, box } = globalThis.kunciIconPlace

const size = 28

function instagramPassword() {
  return { left: 16, top: 220, right: 374, bottom: 268, width: 358, height: 48 }
}

describe('kunci icon placement', () => {
  it('sits to the right of the field when the viewport is wide', () => {
    const field = { left: 80, top: 120, right: 360, bottom: 156, width: 280, height: 36 }
    const pos = iconPosition(field, { width: 1200, height: 800 })
    expect(pos.left).toBe(field.right + 8)
    expect(overlaps(box(pos.left, pos.top, size), field)).toBe(false)
  })

  it('does not cover a full-width password field (Instagram eye button)', () => {
    const field = instagramPassword()
    const pos = iconPosition(field, { width: 390, height: 844 })
    const icon = box(pos.left, pos.top, size)
    expect(overlaps(icon, field)).toBe(false)
    expect(pos.top + size).toBeLessThanOrEqual(field.top)
  })

  it('moves below when the field is flush with the top of the viewport', () => {
    const field = { left: 16, top: 8, right: 374, bottom: 56, width: 358, height: 48 }
    const pos = iconPosition(field, { width: 390, height: 844 })
    const icon = box(pos.left, pos.top, size)
    expect(overlaps(icon, field)).toBe(false)
    expect(pos.top).toBeGreaterThanOrEqual(field.bottom)
  })
})
