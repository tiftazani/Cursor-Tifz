// Post-fix verification sweep. Excludes elements legitimately scrolled inside a
// scroll container, and checks the chip row is no longer squeezed.
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const OUT = '/Users/tiftazani/.hermes/cache/scratch/kunci-verify'
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
  console.log(`[${sev}] ${ctx} / ${kind}: ${msg}${extra ? ' :: ' + JSON.stringify(extra).slice(0, 260) : ''}`)
}

const PROBE = `(() => {
  const de = document.documentElement
  const vis = (el) => { const cs = getComputedStyle(el); if (cs.display==='none'||cs.visibility==='hidden'||cs.opacity==='0') return false; const r=el.getBoundingClientRect(); return r.width>0&&r.height>0 }
  // an element inside a scrollable ancestor may sit outside the viewport legally
  const inScroller = (el) => { let n = el.parentElement; while (n && n !== document.body) { const cs = getComputedStyle(n); if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.overflow === 'auto' || cs.overflow === 'scroll') && n.scrollWidth > n.clientWidth + 2) return true; n = n.parentElement } return false }
  const out = { overflowX: de.scrollWidth - de.clientWidth, offscreen: [], tiny: [], noname: [], unlabeled: [], clipped: [], squeezed: [] }
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el)) continue
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    if (cs.position === 'fixed') continue
    if (r.right > de.clientWidth + 2 || r.left < -2) {
      if (inScroller(el)) continue
      out.offscreen.push(el.tagName.toLowerCase() + '.' + String(el.className).slice(0,34) + ' [' + Math.round(r.left) + '..' + Math.round(r.right) + '] "' + (el.innerText||'').slice(0,24) + '"')
    }
  }
  for (const b of document.querySelectorAll('button, a[href], input[type=checkbox], input[type=radio], [role=button]')) {
    if (!vis(b)) continue
    const r = b.getBoundingClientRect()
    if (r.width < 24 || r.height < 24)
      out.tiny.push(String(b.className).slice(0,30) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' "' + (b.getAttribute('aria-label')||b.innerText||'').slice(0,20) + '"')
    const n = (b.getAttribute('aria-label') || b.textContent || b.title || '').trim()
    if (!n && b.tagName === 'BUTTON') out.noname.push(String(b.className).slice(0,36))
  }
  for (const i of document.querySelectorAll('input, select, textarea')) {
    if (!vis(i)) continue
    const id = i.id
    const lab = id ? document.querySelector('label[for="' + CSS.escape(id) + '"]') : null
    if (!lab && !i.closest('label') && !i.getAttribute('aria-label') && !i.getAttribute('aria-labelledby'))
      out.unlabeled.push(i.tagName + '[' + i.type + '] ph="' + (i.placeholder||'') + '"')
  }
  // clipping of text by its own box, ignoring scroll containers
  for (const el of document.querySelectorAll('strong, em, span, p, h1, h2, h3, label, code, kbd, small, td, th')) {
    if (!vis(el)) continue
    const cs = getComputedStyle(el)
    if (cs.overflow === 'visible') continue
    if (el.scrollHeight > el.clientHeight + 2 && cs.overflowY === 'hidden' && (el.textContent||'').trim())
      out.clipped.push('Y ' + el.tagName.toLowerCase() + '.' + String(el.className).slice(0,28) + ' sh=' + el.scrollHeight + ' ch=' + el.clientHeight + ' "' + (el.textContent||'').trim().slice(0,26) + '"')
  }
  // chip row: must be at least as tall as its tallest chip
  const fr = document.querySelector('.filter-row')
  if (fr) {
    const chip = fr.querySelector('.chip')
    if (chip) {
      const fh = fr.getBoundingClientRect().height, ch = chip.getBoundingClientRect().height
      if (fh + 0.5 < ch) out.squeezed.push('filter-row h=' + fh.toFixed(1) + ' < chip h=' + ch.toFixed(1))
    }
  }
  return out
})()`

const browser = await chromium.launch({ channel: 'chrome' })

for (const vp of VPS) {
  for (const theme of ['dark', 'light']) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } })
    const page = await ctx.newPage()
    const errs = []
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)) })
    page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message.slice(0, 160)))
    await page.goto('http://127.0.0.1:5173/#preview-ui', { waitUntil: 'domcontentloaded' })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
    await page.evaluate((t) => { document.documentElement.dataset.theme = t }, theme)
    await page.waitForTimeout(150)

    for (const v of VIEWS) {
      const label = `${vp.name}/${theme}/${v}`
      const nav = page.locator(`.nav-item:has-text("${v}")`).first()
      if (await nav.count() && await nav.isVisible().catch(() => false)) await nav.click({ timeout: 3000 }).catch(() => {})
      else {
        const more = page.locator('.nav-more-btn').first()
        if (await more.count() && await more.isVisible().catch(() => false)) {
          await more.click().catch(() => {}); await page.waitForTimeout(200)
          const s = page.locator(`.more-sheet .nav-item:has-text("${v}")`).first()
          if (await s.count()) await s.click().catch(() => {})
        }
      }
      await page.waitForTimeout(400)

      // stress: a long vault must not squash the chip row
      if (v === 'Brankas') {
        await page.evaluate(() => {
          const ul = document.querySelector('.entry-list')
          const proto = ul && ul.querySelector('li')
          if (!proto) return
          for (let i = 0; i < 60; i++) { const c = proto.cloneNode(true); c.setAttribute('data-synth', '1'); ul.appendChild(c) }
        })
        await page.waitForTimeout(250)
      }

      const r = await page.evaluate(PROBE)
      if (r.overflowX > 0) add('high', label, 'overflow-x', `${r.overflowX}px`, r.offscreen.slice(0, 4))
      if (r.offscreen.length) add('medium', label, 'offscreen', `${r.offscreen.length}`, r.offscreen.slice(0, 4))
      if (r.squeezed.length) add('high', label, 'chip-squeezed', r.squeezed.join('; '))
      if (r.tiny.length) add('low', label, 'tiny-target', `${r.tiny.length}`, r.tiny.slice(0, 6))
      if (r.noname.length) add('medium', label, 'a11y-noname', `${r.noname.length}`, r.noname.slice(0, 4))
      if (r.unlabeled.length) add('medium', label, 'a11y-label', `${r.unlabeled.length}`, r.unlabeled.slice(0, 4))
      if (r.clipped.length) add('medium', label, 'clip', `${r.clipped.length}`, r.clipped.slice(0, 5))
      await page.screenshot({ path: `${OUT}/shots/${vp.name}-${theme}-${v}.png` })
    }
    for (const e of errs.slice(0, 6)) add('high', `${vp.name}/${theme}`, 'console', e)
    await ctx.close()
  }
}

writeFileSync(`${OUT}/findings.json`, JSON.stringify(findings, null, 2))
console.log(`\n=== ${findings.length} findings ===`)
const byKind = {}
for (const f of findings) byKind[f.kind] = (byKind[f.kind] || 0) + 1
console.log(JSON.stringify(byKind, null, 1))
await browser.close()
