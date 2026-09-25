import { describe, expect, it } from 'vitest'
import '../extension/icon-place.js'

const { iconPosition, overlaps, box, overlapArea } = (globalThis as unknown as {
  kunciIconPlace: {
    iconPosition: (
      field: { left: number; top: number; right: number; bottom: number },
      viewport: { width: number; height: number },
      options?: { size?: number; gap?: number; margin?: number; avoid?: unknown[] },
    ) => { left: number; top: number }
    overlaps: (a: unknown, b: unknown) => boolean
    box: (left: number, top: number, size: number) => unknown
    overlapArea: (a: unknown, b: unknown) => number
  }
}).kunciIconPlace

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

  // Finding B7: the icon is `position:fixed; z-index:2147483645`, so wherever it lands
  // it eats the click. On a tight form the password box sits right next to the submit
  // button and the icon covered the button, so the user's click on "Masuk" did nothing.
  it('does not cover the submit button sitting right of the field', () => {
    const field = { left: 165, top: 200, right: 318, bottom: 236, width: 153, height: 36 }
    const submit = { left: 322, top: 200, right: 377, bottom: 236, width: 55, height: 36 }
    const pos = iconPosition(field, { width: 900, height: 700 }, { size, avoid: [submit] })
    const icon = box(pos.left, pos.top, size)
    expect(overlaps(icon, submit)).toBe(false)
    expect(overlaps(icon, field)).toBe(false)
  })

  it('still prefers the free spot when there is no obstacle', () => {
    const field = { left: 80, top: 120, right: 360, bottom: 156, width: 280, height: 36 }
    const pos = iconPosition(field, { width: 1200, height: 800 }, { size, avoid: [] })
    expect(pos.left).toBe(field.right + 8)
  })

  it('falls back to the least-bad spot when every candidate touches something', () => {
    const field = { left: 40, top: 40, right: 360, bottom: 76, width: 320, height: 36 }
    const wall = { left: 0, top: 0, right: 1000, bottom: 1000 }
    const pos = iconPosition(field, { width: 1000, height: 1000 }, { size, avoid: [wall] })
    // No candidate is free, but the icon must still be on screen and a real position.
    expect(pos.left).toBeGreaterThanOrEqual(0)
    expect(pos.top).toBeGreaterThanOrEqual(0)
    expect(pos.left + size).toBeLessThanOrEqual(1000)
    expect(pos.top + size).toBeLessThanOrEqual(1000)
  })

  it('scores overlap by area', () => {
    const a = { left: 0, top: 0, right: 10, bottom: 10 }
    expect(overlapArea(a, a)).toBe(100)
    expect(overlapArea(a, { left: 20, top: 20, right: 30, bottom: 30 })).toBe(0)
    expect(overlapArea(a, { left: 5, top: 0, right: 15, bottom: 10 })).toBe(50)
  })
})
