// Check mask rendering, contrast ratios, a11y names, and stale-dist drift.
import { chromium } from 'playwright'

const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
await page.goto('http://127.0.0.1:5173/#preview-ui', { waitUntil: 'domcontentloaded' })
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)
await page.locator('.nav-item:has-text("Brankas")').first().click()
await page.waitForTimeout(600)

console.log('=== FILTER ROW ===')
console.log(await page.evaluate(() => {
  const fr = document.querySelector('.filter-row')
  const cs = getComputedStyle(fr)
  return JSON.stringify({
    maskImage: cs.maskImage, webkitMaskImage: cs.webkitMaskImage,
    maskSize: cs.maskSize, maskRepeat: cs.maskRepeat, maskComposite: cs.maskComposite,
    hasMaskSupport: CSS.supports('mask-image', 'linear-gradient(black, transparent)'),
    paddingRight: cs.paddingRight, overflowX: cs.overflowX, flexWrap: cs.flexWrap,
    scrollLeft: fr.scrollLeft, scrollWidth: fr.scrollWidth, clientWidth: fr.clientWidth,
  }, null, 1)
}))

console.log('\n=== CONTRAST (dark) ===')
console.log(await page.evaluate(() => {
  const lum = (c) => {
    const [r, g, b] = c.match(/\d+/g).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return ((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2) }
  const bgOf = (el) => {
    let n = el
    while (n) { const c = getComputedStyle(n).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c; n = n.parentElement }
    return 'rgb(0,0,0)'
  }
  const out = []
  const seen = new Set()
  for (const el of document.querySelectorAll('.muted, .chip, .field-label, .entry-row em, .nav-item, .helper-chip, .linkish, .kbd, kbd, .pill, .tag, .hint, small')) {
    const t = (el.innerText || '').trim()
    if (!t || t.length > 45) continue
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    if (r.width === 0) continue
    const key = cs.color + '|' + bgOf(el)
    if (seen.has(key)) continue
    seen.add(key)
    const cr = Number(ratio(cs.color, bgOf(el)))
    const size = parseFloat(cs.fontSize)
    const bold = Number(cs.fontWeight) >= 700
    const large = size >= 24 || (size >= 18.66 && bold)
    const need = large ? 3 : 4.5
    out.push({ text: t.slice(0, 30), cls: String(el.className).slice(0, 24), color: cs.color, bg: bgOf(el), size: size.toFixed(1), ratio: cr, need, FAIL: cr < need })
  }
  return JSON.stringify(out.filter((o) => o.FAIL), null, 1)
}))

console.log('\n=== A11Y NAMES / LABELS (vault) ===')
console.log(await page.evaluate(() => {
  const bad = []
  for (const b of document.querySelectorAll('button, [role="button"], a[href]')) {
    const r = b.getBoundingClientRect()
    if (r.width === 0) continue
    const n = (b.getAttribute('aria-label') || b.textContent || b.title || '').trim()
    if (!n) bad.push('NO-NAME: ' + b.tagName + '.' + String(b.className).slice(0, 40))
  }
  for (const i of document.querySelectorAll('input, select, textarea')) {
    const r = i.getBoundingClientRect()
    if (r.width === 0) continue
    const id = i.id
    const lab = id ? document.querySelector('label[for="' + CSS.escape(id) + '"]') : null
    if (!lab && !i.closest('label') && !i.getAttribute('aria-label') && !i.getAttribute('aria-labelledby')) {
      bad.push('NO-LABEL: ' + i.tagName + ' type=' + i.type + ' ph="' + (i.placeholder || '') + '" name=' + (i.name || '') + ' cls=' + String(i.className))
    }
  }
  return JSON.stringify(bad, null, 1)
}))

console.log('\n=== TINY TARGETS (vault) ===')
console.log(await page.evaluate(() => {
  const t = []
  for (const b of document.querySelectorAll('button, a[href], input[type=checkbox], input[type=radio], [role=button]')) {
    const r = b.getBoundingClientRect()
    if (r.width === 0) continue
    if (r.width < 24 || r.height < 24) t.push(String(b.className).slice(0, 40) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' "' + (b.getAttribute('aria-label') || b.innerText || '').slice(0, 24) + '"')
  }
  return JSON.stringify(t, null, 1)
}))

console.log('\n=== NESTED INTERACTIVE ===')
console.log(await page.evaluate(() => {
  const bad = []
  for (const a of document.querySelectorAll('button, a[href], label')) {
    if (a.querySelector('button, a[href], input, select')) bad.push(a.tagName + '.' + String(a.className).slice(0, 40) + ' contains ' + a.querySelector('button, a[href], input, select').tagName)
  }
  return JSON.stringify(bad, null, 1)
}))

await browser.close()
