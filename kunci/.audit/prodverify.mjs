// Verify the DEPLOYED site: the screens reachable without OTP (gate/login),
// plus confirm the fixed CSS shipped.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const OUT = '/Users/tiftazani/.hermes/cache/scratch/kunci-prod'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)) })

await page.goto('https://kunci-tifta.netlify.app/', { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(4000)

console.log('title:', await page.title())
console.log('url:', page.url())
console.log('body:', (await page.evaluate(() => document.body.innerText)).slice(0, 400).replace(/\n/g, ' | '))

const vars = await page.evaluate(() => {
  const cs = getComputedStyle(document.documentElement)
  const names = ['--accent', '--accent-2', '--danger', '--warn', '--ok', '--on-warn']
  const o = {}
  for (const n of names) o[n] = cs.getPropertyValue(n).trim()
  return o
})
console.log('tokens on prod:', JSON.stringify(vars))

await page.screenshot({ path: `${OUT}/prod-gate.png`, fullPage: true })

// contrast on the gate
const bad = await page.evaluate(() => {
  const parse = (c) => {
    if (!c) return null
    c = c.trim()
    let m = c.match(/^rgba?\(([^)]+)\)$/)
    if (m) { const p = m[1].split(/[,\/\s]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 } }
    m = c.match(/^color\(srgb ([^)]+)\)$/)
    if (m) { const p = m[1].split(/[\/\s]+/).filter(Boolean).map(Number); return { r: p[0]*255, g: p[1]*255, b: p[2]*255, a: p.length > 3 ? p[3] : 1 } }
    return null
  }
  const over = (f, b) => ({ r: f.r*f.a + b.r*(1-f.a), g: f.g*f.a + b.g*(1-f.a), b: f.b*f.a + b.b*(1-f.a), a: 1 })
  const lum = (c) => { const f = (v) => { v/=255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4) }; return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b) }
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05) }
  const effBg = (el) => {
    const stack = []
    let n = el
    while (n) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break } n = n.parentElement }
    let base = { r: 255, g: 255, b: 255, a: 1 }
    for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i], base)
    return base
  }
  const out = []
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length) continue
    const t = (el.textContent || '').trim()
    if (!t || t.length > 60) continue
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') continue
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) continue
    const fg = parse(cs.color); if (!fg) continue
    const bg = effBg(el)
    const size = parseFloat(cs.fontSize)
    const need = (size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700)) ? 3 : 4.5
    const cr = ratio(over(fg, bg), bg)
    if (cr < need) out.push(`${cs.color} on rgb(${[bg.r,bg.g,bg.b].map((v)=>Math.round(v)).join(',')}) = ${cr.toFixed(2)} "${t.slice(0,30)}"`)
  }
  return out
})
console.log('prod contrast failures:', bad.length ? bad.join('\n  ') : 'none')
console.log('prod console errors:', errs.length ? errs.slice(0, 5).join('\n  ') : 'none')

await browser.close()
