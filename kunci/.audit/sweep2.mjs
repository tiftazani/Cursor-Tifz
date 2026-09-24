// Full sweep: every view x every viewport x both themes.
// Collect console errors, overflow, tiny targets, contrast, clipping.
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = '/Users/tiftazani/.hermes/cache/scratch/kunci-sweep'
mkdirSync(`${OUT}/shots`, { recursive: true })

const VIEWS = ['Ringkasan', 'Brankas', 'Generator', 'Kesehatan', 'Riwayat', 'Autofill', 'Cadangan', 'Pengaturan']
const VPS = [
  { w: 1440, h: 900, name: 'desktop-1440' },
  { w: 1280, h: 800, name: 'laptop-1280' },
  { w: 1101, h: 800, name: 'edge-1101' },
  { w: 1100, h: 800, name: 'compact-1100' },
  { w: 900, h: 700, name: 'tablet-900' },
  { w: 390, h: 844, name: 'phone-390' },
  { w: 320, h: 568, name: 'phone-320' },
]

const findings = []
const add = (sev, ctx, kind, msg, extra) => {
  findings.push({ sev, ctx, kind, msg, ...(extra ? { extra } : {}) })
  console.log(`[${sev}] ${ctx} / ${kind}: ${msg}${extra ? ' :: ' + JSON.stringify(extra).slice(0, 300) : ''}`)
}

const PROBE = `(() => {
  const de = document.documentElement
  const vis = (el) => { const cs = getComputedStyle(el); if (cs.display==='none'||cs.visibility==='hidden'||cs.opacity==='0') return false; const r=el.getBoundingClientRect(); return r.width>0&&r.height>0 }
  const out = { overflowX: de.scrollWidth - de.clientWidth, offscreen: [], tiny: [], noname: [], unlabeled: [], clipped: [], contrast: [] }
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el)) continue
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    if (cs.position === 'fixed' && r.right > window.innerWidth + 2) continue
    if (r.right > de.clientWidth + 2 || r.left < -2)
      out.offscreen.push(el.tagName.toLowerCase() + '.' + String(el.className).slice(0,36) + ' [' + Math.round(r.left) + '..' + Math.round(r.right) + '] "' + (el.innerText||'').slice(0,26) + '"')
  }
  for (const b of document.querySelectorAll('button, a[href], input[type=checkbox], input[type=radio], [role=button]')) {
    if (!vis(b)) continue
    const r = b.getBoundingClientRect()
    if (r.width < 24 || r.height < 24)
      out.tiny.push(String(b.className).slice(0,32) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' "' + (b.getAttribute('aria-label')||b.innerText||'').slice(0,22) + '"')
    const n = (b.getAttribute('aria-label') || b.textContent || b.title || '').trim()
    if (!n && b.tagName === 'BUTTON') out.noname.push(String(b.className).slice(0,40))
  }
  for (const i of document.querySelectorAll('input, select, textarea')) {
    if (!vis(i)) continue
    const id = i.id
    const lab = id ? document.querySelector('label[for="' + CSS.escape(id) + '"]') : null
    if (!lab && !i.closest('label') && !i.getAttribute('aria-label') && !i.getAttribute('aria-labelledby'))
      out.unlabeled.push(i.tagName + '[' + i.type + '] ph="' + (i.placeholder||'') + '" cls=' + String(i.className).slice(0,26))
  }
  for (const el of document.querySelectorAll('strong, em, span, p, h1, h2, h3, label, code, kbd, small, td, th, .chip, .btn')) {
    if (!vis(el)) continue
    const cs = getComputedStyle(el)
    if (cs.overflow === 'visible' && cs.overflowX === 'visible') continue
    if (el.scrollWidth > el.clientWidth + 2 && cs.overflowX === 'hidden' && cs.textOverflow !== 'ellipsis' && (el.innerText||'').trim())
      out.clipped.push('X ' + el.tagName.toLowerCase() + '.' + String(el.className).slice(0,30) + ' sw=' + el.scrollWidth + ' cw=' + el.clientWidth + ' "' + (el.innerText||'').trim().slice(0,30) + '"')
    if (el.scrollHeight > el.clientHeight + 2 && cs.overflowY === 'hidden' && (el.innerText||'').trim())
      out.clipped.push('Y ' + el.tagName.toLowerCase() + '.' + String(el.className).slice(0,30) + ' sh=' + el.scrollHeight + ' ch=' + el.clientHeight + ' "' + (el.innerText||'').trim().slice(0,30) + '"')
  }
  // contrast on text nodes with explicit colour
  const lum = (c) => { const m = c.match(/[\\d.]+/g); if (!m) return 0; const [r,g,b] = m.slice(0,3).map(Number).map(v => { v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4) }); return 0.2126*r+0.7152*g+0.0722*b }
  const bgOf = (el) => { let n = el; while (n) { const c = getComputedStyle(n).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c; n = n.parentElement } return 'rgb(255,255,255)' }
  const seen = new Set()
  for (const el of document.querySelectorAll('p, span, strong, em, small, label, button, a, li, h1, h2, h3, code, kbd, td, th, .muted, .chip, .nav-item, .field-label')) {
    if (!vis(el)) continue
    const t = (el.innerText||'').trim(); if (!t || t.length > 50) continue
    if (el.children.length > 0 && el.tagName !== 'BUTTON') continue
    const cs = getComputedStyle(el)
    const bg = bgOf(el)
    const key = cs.color + '|' + bg + '|' + cs.fontSize
    if (seen.has(key)) continue; seen.add(key)
    const cr = (() => { const a1 = lum(cs.color), b1 = lum(bg); return (Math.max(a1,b1)+0.05)/(Math.min(a1,b1)+0.05) })()
    const size = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700
    const need = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5
    if (cr < need) out.contrast.push(cs.color + ' on ' + bg + ' = ' + cr.toFixed(2) + ' (need ' + need + ') ' + size.toFixed(1) + 'px "' + t.slice(0,26) + '"')
  }
  return out
})()`

const browser = await chromium.launch({ channel: 'chrome' })

for (const vp of VPS) {
  for (const theme of ['dark', 'light']) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 })
    const page = await ctx.newPage()
    const errs = []
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)) })
    page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message.slice(0, 200)))
    await page.goto('http://127.0.0.1:5173/#preview-ui', { waitUntil: 'domcontentloaded' })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1600)
    await page.evaluate((t) => { document.documentElement.dataset.theme = t }, theme)
    await page.waitForTimeout(150)

    for (const v of VIEWS) {
      const label = `${vp.name}/${theme}/${v}`
      const moreBtn = page.locator('.nav-more-btn').first()
      const nav = page.locator(`.nav-item:has-text("${v}")`).first()
      if (await nav.count() && await nav.isVisible().catch(() => false)) {
        await nav.click({ timeout: 3000 }).catch(() => {})
      } else if (await moreBtn.count() && await moreBtn.isVisible().catch(() => false)) {
        await moreBtn.click().catch(() => {})
        await page.waitForTimeout(200)
        const s = page.locator(`.more-sheet .nav-item:has-text("${v}")`).first()
        if (await s.count()) await s.click().catch(() => {})
      }
      await page.waitForTimeout(450)
      const r = await page.evaluate(PROBE)
      if (r.overflowX > 0) add('high', label, 'overflow-x', `${r.overflowX}px`, r.offscreen.slice(0, 4))
      if (r.offscreen.length) add('medium', label, 'offscreen', `${r.offscreen.length} elemen`, r.offscreen.slice(0, 4))
      if (r.tiny.length) add('low', label, 'tiny-target', `${r.tiny.length} target <24px`, r.tiny.slice(0, 6))
      if (r.noname.length) add('medium', label, 'a11y-noname', `${r.noname.length} button tanpa nama`, r.noname.slice(0, 4))
      if (r.unlabeled.length) add('medium', label, 'a11y-label', `${r.unlabeled.length} input tanpa label`, r.unlabeled.slice(0, 4))
      if (r.clipped.length) add('medium', label, 'clip', `${r.clipped.length} teks terpotong`, r.clipped.slice(0, 5))
      if (r.contrast.length) add('medium', label, 'contrast', `${r.contrast.length} rasio < AA`, r.contrast.slice(0, 5))
      await page.screenshot({ path: `${OUT}/shots/${vp.name}-${theme}-${v}.png` })
    }
    for (const e of errs.slice(0, 8)) add('high', `${vp.name}/${theme}`, 'console', e)
    await ctx.close()
  }
}

writeFileSync(`${OUT}/findings.json`, JSON.stringify(findings, null, 2))
console.log(`\n=== ${findings.length} findings ===`)
const byKind = {}
for (const f of findings) byKind[f.kind] = (byKind[f.kind] || 0) + 1
console.log(JSON.stringify(byKind, null, 1))
await browser.close()
