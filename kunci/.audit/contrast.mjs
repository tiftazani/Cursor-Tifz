import { chromium } from 'playwright'

const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

await page.goto('http://127.0.0.1:5173/#preview-ui', { waitUntil: 'domcontentloaded' })
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)

const res = await page.evaluate(() => {
  function parse(c) {
    const m = c.match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const p = m[1].split(',').map((x) => parseFloat(x))
    return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }
  }
  function lum({ r, g, b }) {
    const f = (v) => {
      v /= 255
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  function bgOf(el) {
    let cur = el
    while (cur) {
      const c = parse(getComputedStyle(cur).backgroundColor)
      if (c && c.a > 0) return c
      cur = cur.parentElement
    }
    return { r: 0, g: 0, b: 0, a: 1 }
  }
  function ratio(fg, bg) {
    // flatten fg over bg
    const a = fg.a
    const f = {
      r: fg.r * a + bg.r * (1 - a),
      g: fg.g * a + bg.g * (1 - a),
      b: fg.b * a + bg.b * (1 - a),
    }
    const l1 = lum(f)
    const l2 = lum(bg)
    const hi = Math.max(l1, l2)
    const lo = Math.min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)
  }

  const samples = []
  const selectors = [
    ['.page .muted', 'muted text'],
    ['.field-label', 'field label'],
    ['.hint-pill', 'hint pill'],
    ['.helper-chip', 'helper chip'],
    ['.dash-kicker', 'dash kicker'],
    ['.nav-item', 'nav item'],
    ['.entry-item .name', 'entry name'],
    ['.entry-item .hint', 'entry hint'],
    ['.chip', 'chip'],
    ['.check', 'check label'],
  ]
  for (const [sel, label] of selectors) {
    const el = document.querySelector(sel)
    if (!el) continue
    const cs = getComputedStyle(el)
    const fg = parse(cs.color)
    const bg = bgOf(el)
    if (!fg) continue
    samples.push({
      label,
      sel,
      color: cs.color,
      bg: `rgb(${bg.r},${bg.g},${bg.b})`,
      size: cs.fontSize,
      weight: cs.fontWeight,
      ratio: Math.round(ratio(fg, bg) * 100) / 100,
    })
  }
  return { theme: document.documentElement.dataset.theme, samples }
})

console.log('theme:', res.theme)
for (const s of res.samples) {
  const need = parseFloat(s.size) >= 18 ? 3 : 4.5
  const ok = s.ratio >= need ? 'PASS' : 'FAIL'
  console.log(`${ok} ${String(s.ratio).padStart(6)} (need ${need}) ${s.label} | ${s.size}/${s.weight} | fg ${s.color} bg ${s.bg}`)
}

await browser.close()