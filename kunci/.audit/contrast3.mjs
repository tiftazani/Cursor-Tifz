// Corrected contrast audit: composite alpha and parse both rgb() and color(srgb ...).
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = '/Users/tiftazani/.hermes/cache/scratch/kunci-contrast'
mkdirSync(OUT, { recursive: true })

const VIEWS = ['Ringkasan', 'Brankas', 'Generator', 'Kesehatan', 'Riwayat', 'Autofill', 'Cadangan', 'Pengaturan']

const PROBE = `(() => {
  const parse = (c) => {
    if (!c) return null
    c = c.trim()
    let m = c.match(/^rgba?\\(([^)]+)\\)$/)
    if (m) { const p = m[1].split(/[,\\/\\s]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 } }
    m = c.match(/^color\\(srgb ([^)]+)\\)$/)
    if (m) { const p = m[1].split(/[\\/\\s]+/).filter(Boolean).map(Number); return { r: p[0]*255, g: p[1]*255, b: p[2]*255, a: p.length > 3 ? p[3] : 1 } }
    return null
  }
  const over = (fg, bg) => ({ r: fg.r*fg.a + bg.r*(1-fg.a), g: fg.g*fg.a + bg.g*(1-fg.a), b: fg.b*fg.a + bg.b*(1-fg.a), a: 1 })
  const lum = (c) => { const f = (v) => { v/=255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4) }; return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b) }
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05) }
  // effective background: walk up compositing until opaque
  const effBg = (el) => {
    let stack = []
    let n = el
    while (n) {
      const c = parse(getComputedStyle(n).backgroundColor)
      if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break }
      n = n.parentElement
    }
    let base = { r: 255, g: 255, b: 255, a: 1 }
    for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i], base)
    return base
  }
  const out = []
  const seen = new Set()
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length) continue
    const txt = (el.textContent || '').trim()
    if (!txt || txt.length > 60) continue
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) continue
    if (r.right < 0 || r.left > window.innerWidth) continue
    const fg = parse(cs.color)
    if (!fg) continue
    const bg = effBg(el)
    const fgc = over(fg, bg)
    const size = parseFloat(cs.fontSize)
    const bold = Number(cs.fontWeight) >= 700
    const need = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5
    const cr = ratio(fgc, bg)
    if (cr >= need) continue
    const key = cs.color + '|' + Math.round(bg.r) + ',' + Math.round(bg.g) + ',' + Math.round(bg.b) + '|' + size
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ text: txt.slice(0, 40), cls: String(el.className).slice(0, 30), tag: el.tagName.toLowerCase(), color: cs.color, bg: 'rgb(' + [bg.r,bg.g,bg.b].map((v)=>Math.round(v)).join(',') + ')', size: +size.toFixed(1), bold, ratio: +cr.toFixed(2), need })
  }
  return out
})()`

const browser = await chromium.launch({ channel: 'chrome' })
const all = []

for (const theme of ['dark', 'light']) {
  for (const w of [1440, 390]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 } })
    const page = await ctx.newPage()
    await page.goto('http://127.0.0.1:5173/#preview-ui', { waitUntil: 'domcontentloaded' })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1600)
    await page.evaluate((t) => { document.documentElement.dataset.theme = t }, theme)
    await page.waitForTimeout(200)
    for (const v of VIEWS) {
      const nav = page.locator(`.nav-item:has-text("${v}")`).first()
      if (await nav.count() && await nav.isVisible().catch(() => false)) await nav.click().catch(() => {})
      else {
        const more = page.locator('.nav-more-btn').first()
        if (await more.count()) { await more.click().catch(() => {}); await page.waitForTimeout(200); const s = page.locator(`.more-sheet .nav-item:has-text("${v}")`).first(); if (await s.count()) await s.click().catch(() => {}) }
      }
      await page.waitForTimeout(400)
      const res = await page.evaluate(PROBE)
      for (const x of res) all.push({ theme, w, view: v, ...x })
    }
    await ctx.close()
  }
}

writeFileSync(`${OUT}/contrast.json`, JSON.stringify(all, null, 2))
console.log(`total contrast failures: ${all.length}`)
const uniq = new Map()
for (const x of all) {
  const k = `${x.color} on ${x.bg} @${x.size}px "${x.text}"`
  if (!uniq.has(k)) uniq.set(k, { n: 0, views: new Set(), themes: new Set() })
  const e = uniq.get(k); e.n++; e.views.add(x.view); e.themes.add(x.theme)
}
console.log(`unique: ${uniq.size}`)
for (const [k, v] of [...uniq.entries()].sort((a, b) => b[1].n - a[1].n)) {
  console.log(`  ${String(v.n).padStart(3)}x [${[...v.themes].join(',')}] ${k}`)
}
await browser.close()
