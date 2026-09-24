import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = process.env.KUNCI_URL || 'http://127.0.0.1:5173/#preview-ui'
const OUT = process.env.KUNCI_OUT || '/Users/tiftazani/.hermes/cache/scratch/kunci-audit'
mkdirSync(`${OUT}/shots`, { recursive: true })

const findings = []
const log = (...a) => console.log(...a)
function note(sev, view, kind, msg, extra = {}) {
  findings.push({ sev, view, kind, msg, ...extra })
  log(`[${sev}] ${view} | ${kind} | ${msg}`)
}

const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

let bucket = []
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') bucket.push(`[${m.type()}] ${m.text()}`)
})
page.on('pageerror', (e) => bucket.push(`[pageerror] ${e.message}`))
page.on('requestfailed', (r) => {
  const u = r.url()
  if (u.startsWith('http://127.0.0.1') || u.startsWith('http://localhost')) bucket.push(`[reqfail] ${u} ${r.failure()?.errorText}`)
})

await page.goto(BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)

log('=== boot text ===')
log((await page.evaluate(() => document.body.innerText)).slice(0, 500))
for (const b of bucket.splice(0)) note('high', 'boot', 'console', b.slice(0, 400))

const VIEWS = ['Ringkasan', 'Brankas', 'Generator', 'Kesehatan', 'Riwayat', 'Autofill', 'Cadangan', 'Pengaturan']

async function snap(name) {
  await page.screenshot({ path: `${OUT}/shots/${name}.png`, fullPage: false })
  await page.screenshot({ path: `${OUT}/shots/${name}-full.png`, fullPage: true })
}

async function layoutProbe(view) {
  return page.evaluate(() => {
    const de = document.documentElement
    const out = {
      docScrollW: de.scrollWidth,
      docClientW: de.clientWidth,
      docScrollH: de.scrollHeight,
      docClientH: de.clientHeight,
      over: [],
      clipped: [],
      zeroText: [],
    }
    const vw = de.clientWidth
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none') continue
      if (r.right > vw + 1.5) {
        out.over.push({
          tag: el.tagName.toLowerCase(),
          cls: String(el.className).slice(0, 60),
          right: Math.round(r.right),
          text: (el.textContent || '').trim().slice(0, 30),
        })
      }
      // text clipped by its own box
      if (el.children.length === 0 && el.textContent.trim()) {
        const clippedX = el.scrollWidth > el.clientWidth + 1
        const clippedY = el.scrollHeight > el.clientHeight + 1
        if ((clippedX || clippedY) && cs.overflow !== 'visible' && cs.overflow !== 'auto' && cs.overflow !== 'scroll') {
          out.clipped.push({
            tag: el.tagName.toLowerCase(),
            cls: String(el.className).slice(0, 50),
            text: el.textContent.trim().slice(0, 40),
            sw: el.scrollWidth,
            cw: el.clientWidth,
            sh: el.scrollHeight,
            ch: el.clientHeight,
          })
        }
      }
    }
    return out
  })
}

for (const v of VIEWS) {
  const nav = page.locator(`.nav-item:has-text("${v}")`).first()
  if (!(await nav.count())) {
    note('high', v, 'nav', 'nav item tidak ditemukan')
    continue
  }
  await nav.click().catch(() => {})
  await page.waitForTimeout(600)
  const st = await layoutProbe(v)
  await snap(v)
  if (st.docScrollW > st.docClientW + 1) note('high', v, 'overflow-x', `scrollWidth ${st.docScrollW} > ${st.docClientW}`)
  if (st.over.length) note('medium', v, 'overflow-el', `${st.over.length} elemen keluar viewport`, { first: st.over.slice(0, 6) })
  if (st.clipped.length) note('medium', v, 'clipped-text', `${st.clipped.length} teks terpotong`, { first: st.clipped.slice(0, 8) })
  for (const b of bucket.splice(0)) note('high', v, 'console', b.slice(0, 400))
}

// ---- interaction sweep on Brankas ----
await page.locator('.nav-item:has-text("Brankas")').first().click()
await page.waitForTimeout(500)

// filter chips
const chips = page.locator('.filter-row .chip')
const chipCount = await chips.count()
log('chips:', chipCount)
for (let i = 0; i < chipCount; i++) {
  const label = (await chips.nth(i).innerText()).trim()
  await chips.nth(i).click().catch(() => {})
  await page.waitForTimeout(250)
  const txt = await page.locator('.entry-list').innerText().catch(() => '')
  log(`  chip "${label}" -> ${txt.replace(/\n+/g, ' / ').slice(0, 120)}`)
  const bad = await page.locator('.entry-list').evaluate((el) => el.scrollWidth > el.clientWidth + 1).catch(() => false)
  if (bad) note('medium', 'Brankas', 'overflow-list', `chip "${label}" bikin daftar meluber`)
  for (const b of bucket.splice(0)) note('high', `Brankas/chip:${label}`, 'console', b.slice(0, 300))
}
await chips.first().click().catch(() => {})
await page.waitForTimeout(200)

// click each entry
const rows = page.locator('.entry-row')
const n = await rows.count()
log('entry rows:', n)
for (let i = 0; i < n; i++) {
  const label = (await rows.nth(i).innerText()).replace(/\n+/g, ' | ')
  await rows.nth(i).click().catch(() => {})
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/shots/entry-${i}.png` })
  const paneText = await page.locator('.detail-col').innerText().catch(() => '')
  log(`  entry[${i}] ${label} -> pane ${paneText.replace(/\n+/g, ' / ').slice(0, 140)}`)
  for (const b of bucket.splice(0)) note('high', `Brankas/entry:${label}`, 'console', b.slice(0, 300))
}

writeFileSync(`${OUT}/findings.json`, JSON.stringify(findings, null, 2))
log('\n=== FINDINGS (' + findings.length + ') ===')
for (const f of findings) log(`[${f.sev}] ${f.view} | ${f.kind} | ${f.msg}`)
await browser.close()
