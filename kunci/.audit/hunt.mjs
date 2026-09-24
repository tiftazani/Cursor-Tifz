// Bug-hunt harness: boot preview UI, walk every view, capture console errors,
// layout overlap, clipping, contrast, and screenshots.
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = process.env.KUNCI_URL || 'http://127.0.0.1:5173/#preview-ui'
const OUT = process.env.KUNCI_OUT || '/Users/tiftazani/.hermes/cache/scratch/kunci-hunt'
mkdirSync(`${OUT}/shots`, { recursive: true })

const VIEWS = ['Ringkasan', 'Brankas', 'Generator', 'Kesehatan', 'Riwayat', 'Autofill', 'Cadangan', 'Pengaturan']
const findings = []
const note = (sev, view, kind, msg, extra) => {
  findings.push({ sev, view, kind, msg, ...(extra ? { extra } : {}) })
  console.log(`[${sev}] ${view} / ${kind}: ${msg}`)
}

const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()

let bucket = []
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') bucket.push(`${m.type()}: ${m.text()}`)
})
page.on('pageerror', (e) => bucket.push(`pageerror: ${e.message}`))
const flush = (view) => {
  for (const t of bucket.splice(0)) note('high', view, 'console', t.slice(0, 400))
}

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2200)
flush('boot')

// Overlap detector: does any child of a scroll container get covered by a sibling?
const LAYOUT = `(() => {
  const de = document.documentElement
  const out = { overflowX: de.scrollWidth - de.clientWidth, clip: [], overlap: [], offscreen: [], hidden: [] }
  const vis = (el) => {
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }
  // text clipped by its own box (scrollHeight > clientHeight with hidden overflow)
  for (const el of document.querySelectorAll('button, span, strong, em, p, h1, h2, h3, li, label, a, td, th, code, kbd')) {
    if (!vis(el)) continue
    const cs = getComputedStyle(el)
    if (cs.overflow === 'visible') continue
    if (el.scrollHeight > el.clientHeight + 2 && cs.overflowY !== 'auto' && cs.overflowY !== 'scroll') {
      out.clip.push({ sel: el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 40), text: (el.innerText || '').slice(0, 40), sh: el.scrollHeight, ch: el.clientHeight })
    }
    if (el.scrollWidth > el.clientWidth + 2 && cs.overflowX === 'hidden' && cs.textOverflow !== 'ellipsis') {
      out.clip.push({ sel: el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 40), text: (el.innerText || '').slice(0, 40), sw: el.scrollWidth, cw: el.clientWidth, axis: 'x' })
    }
  }
  // elements escaping the viewport
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el)) continue
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    if (cs.position === 'fixed' && r.right > window.innerWidth + 2) continue
    if (r.right > de.clientWidth + 2 || r.left < -2) {
      out.offscreen.push({ sel: el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 40), text: (el.innerText || '').slice(0, 30), left: Math.round(r.left), right: Math.round(r.right) })
    }
  }
  // scroll containers whose children are covered by a later sibling
  for (const box of document.querySelectorAll('.list-col, .detail-col, .main-col, .sidebar, .card, .stack')) {
    const kids = [...box.children].filter(vis)
    for (let i = 0; i < kids.length; i++) {
      for (let j = i + 1; j < kids.length; j++) {
        const a = kids[i].getBoundingClientRect(), b = kids[j].getBoundingClientRect()
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left)
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
        if (ox > 4 && oy > 4) {
          const az = getComputedStyle(kids[i]).zIndex, bz = getComputedStyle(kids[j]).zIndex
          out.overlap.push({
            parent: String(box.className).slice(0, 30),
            a: String(kids[i].className).slice(0, 30) + '(' + kids[i].tagName + ')',
            b: String(kids[j].className).slice(0, 30) + '(' + kids[j].tagName + ')',
            overlap: Math.round(ox) + 'x' + Math.round(oy),
            z: az + '/' + bz,
          })
        }
      }
    }
  }
  return out
})()`

async function walk(label, prep) {
  if (prep) await prep()
  await page.waitForTimeout(500)
  const res = await page.evaluate(LAYOUT)
  if (res.overflowX > 0) note('high', label, 'overflow', `horizontal overflow ${res.overflowX}px`, res.offscreen.slice(0, 5))
  if (res.overlap.length) note('high', label, 'overlap', `${res.overlap.length} elemen bertumpuk`, res.overlap.slice(0, 6))
  if (res.clip.length) note('medium', label, 'clip', `${res.clip.length} teks terpotong`, res.clip.slice(0, 6))
  if (res.offscreen.length) note('medium', label, 'offscreen', `${res.offscreen.length} elemen keluar layar`, res.offscreen.slice(0, 5))
  await page.screenshot({ path: `${OUT}/shots/${label}.png` })
  flush(label)
  return res
}

const clickNav = async (text) => {
  const el = page.locator(`.nav-item:has-text("${text}")`).first()
  if (!(await el.count())) return false
  await el.click({ timeout: 4000 }).catch(() => {})
  return true
}

for (const v of VIEWS) {
  if (v !== 'Ringkasan') await clickNav(v)
  await walk(v.replace(/\s/g, '-').toLowerCase())
}

// deep dives
await clickNav('Brankas')
await page.waitForTimeout(400)
const rows = page.locator('.entry-row')
const n = await rows.count()
console.log('entry rows:', n)
for (let i = 0; i < Math.min(n, 12); i++) {
  await rows.nth(i).click().catch(() => {})
  await page.waitForTimeout(350)
  const name = (await page.locator('.detail-col input').first().inputValue().catch(() => '')) || String(i)
  const res = await page.evaluate(LAYOUT)
  if (res.overlap.length) note('high', `entry:${name}`, 'overlap', `${res.overlap.length} bertumpuk`, res.overlap.slice(0, 4))
  if (res.clip.length) note('medium', `entry:${name}`, 'clip', `${res.clip.length} terpotong`, res.clip.slice(0, 4))
  if (res.offscreen.length) note('medium', `entry:${name}`, 'offscreen', `${res.offscreen.length} keluar`, res.offscreen.slice(0, 4))
  await page.screenshot({ path: `${OUT}/shots/entry-${i}.png` })
  flush(`entry:${i}`)
}

writeFileSync(`${OUT}/findings.json`, JSON.stringify(findings, null, 2))
console.log('\n=== SUMMARY ===')
console.log(JSON.stringify(findings.map((f) => `[${f.sev}] ${f.view} / ${f.kind}: ${f.msg}`), null, 1))
await browser.close()
