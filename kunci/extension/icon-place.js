;(function (root) {
  const SIZE = 28
  const GAP = 8
  const MARGIN = 4

  function overlaps(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  }

  function box(left, top, size) {
    return { left, top, right: left + size, bottom: top + size }
  }

  function onScreen(b, viewport, margin) {
    return b.left >= margin && b.top >= margin && b.right <= viewport.width - margin && b.bottom <= viewport.height - margin
  }

  function iconPosition(field, viewport, options) {
    const size = options?.size ?? SIZE
    const gap = options?.gap ?? GAP
    const margin = options?.margin ?? MARGIN
    const midY = Math.round(field.top + ((field.bottom - field.top) - size) / 2)
    const fieldBox = { left: field.left, top: field.top, right: field.right, bottom: field.bottom }
    const candidates = [
      { left: field.right + gap, top: midY },
      { left: field.left - gap - size, top: midY },
      { left: field.right - size, top: field.top - gap - size },
      { left: field.left, top: field.top - gap - size },
      { left: field.right - size, top: field.bottom + gap },
      { left: field.left, top: field.bottom + gap },
    ]
    for (const c of candidates) {
      const left = Math.round(c.left)
      const top = Math.round(c.top)
      const b = box(left, top, size)
      if (!onScreen(b, viewport, margin)) continue
      if (overlaps(b, fieldBox)) continue
      return { left, top }
    }
    const left = Math.round(Math.min(Math.max(margin, field.right - size), viewport.width - size - margin))
    const top = Math.round(Math.min(Math.max(margin, field.top - gap - size), viewport.height - size - margin))
    return { left, top }
  }

  root.kunciIconPlace = { iconPosition, overlaps, box }
})(typeof globalThis !== 'undefined' ? globalThis : window)
