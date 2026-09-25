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

  function overlapArea(a, b) {
    if (!overlaps(a, b)) return 0
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
    const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
    return w * h
  }

  /**
   * Where to put the fill icon next to a field.
   *
   * `avoid` is the list of other boxes the icon must not sit on top of. The icon is
   * `position:fixed; z-index:2147483645`, so anywhere it lands it eats the click: a
   * 28px icon on the corner of a submit button made the button unclickable. Only the
   * field itself used to be avoided, which is exactly the case that broke — a tight
   * form puts the submit button right next to the password box.
   *
   * Every candidate is scored instead of taking the first free one: when nothing is
   * free, the least-bad spot is better than the first spot.
   */
  function iconPosition(field, viewport, options) {
    const size = options?.size ?? SIZE
    const gap = options?.gap ?? GAP
    const margin = options?.margin ?? MARGIN
    const avoid = Array.isArray(options?.avoid) ? options.avoid.filter(Boolean) : []
    const midY = Math.round(field.top + ((field.bottom - field.top) - size) / 2)
    const fieldBox = { left: field.left, top: field.top, right: field.right, bottom: field.bottom }
    const candidates = [
      { left: field.right + gap, top: midY },
      { left: field.left - gap - size, top: midY },
      { left: field.right - size, top: field.top - gap - size },
      { left: field.left, top: field.top - gap - size },
      { left: field.right - size, top: field.bottom + gap },
      { left: field.left, top: field.bottom + gap },
      { left: field.right + gap, top: field.top - gap - size },
      { left: field.left - gap - size, top: field.bottom + gap },
      { left: field.right + gap, top: field.bottom + gap },
      { left: field.left - gap - size, top: field.top - gap - size },
    ]
    let best = null
    let bestCost = Infinity
    for (const c of candidates) {
      const left = Math.round(c.left)
      const top = Math.round(c.top)
      const b = box(left, top, size)
      if (!onScreen(b, viewport, margin)) continue
      let cost = overlapArea(b, fieldBox) * 100
      for (const other of avoid) cost += overlapArea(b, other)
      if (cost === 0) return { left, top }
      if (cost < bestCost) {
        bestCost = cost
        best = { left, top }
      }
    }
    if (best) return best
    const left = Math.round(Math.min(Math.max(margin, field.right - size), viewport.width - size - margin))
    const top = Math.round(Math.min(Math.max(margin, field.top - gap - size), viewport.height - size - margin))
    return { left, top }
  }

  root.kunciIconPlace = { iconPosition, overlaps, box, overlapArea }
})(typeof globalThis !== 'undefined' ? globalThis : window)
