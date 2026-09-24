import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = process.env.KUNCI_URL || 'http://127.0.0.1:5173/#preview-ui'
const OUT = process.env.KUNCI_OUT || '/Users/tiftazani/.hermes/cache/scratch/kunci-audit'
mkdirSync(`${OUT}/shots`, { recursive: true })

const VIEWS = ['home', 'vault', 'generator', 'health', 'history', 'autofill', 'backup', 'settings']
const LABELS = {
  home: 'Ringkasan',
  vault: 'Brankas',
  generator: 'Generator',
  health: 'Kesehatan',
  history: 'Riwayat',
  autofill: 'Autofill',
  backup: 'Cadangan',
  settings: 'Pengaturan',
}

const findings = []

function note(severity, view, kind, message, extra = {}) {
  findings.push({ severity, view, kind, message, ...extra })
  console.log(`[${severity}] ${view} ${kind}: ${message}`)
}

const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()

const consoleMsgs = []
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') consoleMsgs.push({ type: m.type(), text: m.text() })
})
page.on('pageerror', (e) => consoleMsgs.push({ type: 'pageerror', text: String(e && e.stack || e) }))

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 400))
console.log('--- initial body text ---')
console.log(bodyText)

// console errors on boot
for (const m of consoleMsgs.splice(0)) {
  note(m.type === 'pageerror' ? 'critical' : 'high', 'boot', 'console', m.text.slice(0, 600))
}

async function clickNav(label) {
  const el = page.locator(`.nav-item:has-text("${label}")`).first()
  if (await el.count()) {
    await el.click({ timeout: 4000 }).catch(() => {})
    await page.waitForTimeout(400)
    return true
  }
  return false
}

async function auditLayout(view) {
  const res = await page.evaluate(() => {
    const doc = document.documentElement
    const out = {
      docScrollW: doc.scrollWidth,
      docClientW: doc.clientWidth,
      bodyScrollW: document.body.scrollWidth,
      viewportH: window.innerHeight,
      overflowing: [],
      tinyTargets: [],
      emptyButtons: [],
      unlabeledInputs: [],
      imagesNoAlt: [],
      lowContrast: [],
    }
    // horizontal overflow offenders
    const all = document.querySelectorAll('body *')
    for (const el of all) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const cs = getComputedStyle(el)
      if (cs.position === 'fixed' && r.right > window.innerWidth + 1) {
        // ok-ish, still flag if way out
      }
      if (r.right > doc.clientWidth + 1 || r.left < -1) {
        out.overflowing.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className || '').toString().slice(0, 80),
          text: (el.textContent || '').trim().slice(0, 40),
          left: Math.round(r.left),
          right: Math.round(r.right),
        })
      }
    }
    for (const b of document.querySelectorAll('button, a[href], [role="button"], input[type="checkbox"], input[type="radio"]')) {
      const r = b.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const cs = getComputedStyle(b)
      if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue
      if (r.width < 24 || r.height < 24) {
        out.tinyTargets.push({
          tag: b.tagName.toLowerCase(),
          cls: (b.className || '').toString().slice(0, 60),
          label: (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 40),
          w: Math.round(r.width),
          h: Math.round(r.height),
        })
      }
      const name = (b.getAttribute('aria-label') || b.textContent || b.title || '').trim()
      if (!name && b.tagName === 'BUTTON') out.emptyButtons.push({ cls: (b.className || '').toString().slice(0, 60) })
    }
    for (const i of document.querySelectorAll('input, select, textarea')) {
      const r = i.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const id = i.id
      const lab = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null
      const wrapping = i.closest('label')
      const aria = i.getAttribute('aria-label')
      if (!lab && !wrapping && !aria) {
        out.unlabeledInputs.push({
          tag: i.tagName.toLowerCase(),
          type: i.type,
          ph: i.placeholder || '',
          name: i.name || '',
        })
      }
    }
    for (const img of document.querySelectorAll('img')) {
      if (!img.hasAttribute('alt')) out.imagesNoAlt.push(img.getAttribute('src') || '')
    }
    return out
  })
  return res
}

const report = { views: {}, findings }

for (const v of VIEWS) {
  if (v !== 'home') {
    const ok = await clickNav(LABELS[v])
    if (!ok) {
      note('high', v, 'nav', `Nav item "${LABELS[v]}" tidak ketemu / tidak bisa diklik`)
      continue
    }
  }
  const state = await auditLayout(v)
  report.views[v] = state
  await page.screenshot({ path: `${OUT}/shots/${v}.png`, fullPage: false })
  await page.screenshot({ path: `${OUT}/shots/${v}-full.png`, fullPage: true })

  if (state.docScrollW > state.docClientW + 1) {
    note('high', v, 'overflow', `Halaman meluber horizontal: scrollWidth ${state.docScrollW} > clientWidth ${state.docClientW}`, { offenders: state.overflowing.slice(0, 8) })
  }
  if (state.overflowing.length) {
    note('medium', v, 'overflow-element', `${state.overflowing.length} elemen keluar viewport`, { offenders: state.overflowing.slice(0, 8) })
  }
  if (state.tinyTargets.length) {
    note('medium', v, 'touch-target', `${state.tinyTargets.length} target < 24px`, { offenders: state.tinyTargets.slice(0, 10) })
  }
  if (state.emptyButtons.length) {
    note('high', v, 'a11y-name', `${state.emptyButtons.length} button tanpa nama`, { offenders: state.emptyButtons })
  }
  if (state.unlabeledInputs.length) {
    note('medium', v, 'a11y-label', `${state.unlabeledInputs.length} input tanpa label`, { offenders: state.unlabeledInputs })
  }
  if (state.imagesNoAlt.length) {
    note('low', v, 'a11y-alt', `${state.imagesNoAlt.length} img tanpa alt`, { offenders: state.imagesNoAlt.slice(0, 6) })
  }

  for (const m of consoleMsgs.splice(0)) {
    note(m.type === 'pageerror' ? 'critical' : 'high', v, 'console', m.text.slice(0, 600))
  }
}

// interaction sweep: vault view -> click first entry, open new entry, save empty
await clickNav('Brankas')
await page.waitForTimeout(300)
const rows = page.locator('.entry-row')
const rowCount = await rows.count()
report.entryRows = rowCount
if (rowCount > 0) {
  await rows.first().click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/shots/vault-entry.png` })
}
for (const m of consoleMsgs.splice(0)) note(m.type === 'pageerror' ? 'critical' : 'high', 'vault-detail', 'console', m.text.slice(0, 600))

// new entry flow
const newBtn = page.locator('.toolbar-new, .fab-new, .btn:has-text("Baru")').first()
if (await newBtn.count()) {
  await newBtn.click().catch(() => {})
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/shots/vault-new.png` })
}
for (const m of consoleMsgs.splice(0)) note(m.type === 'pageerror' ? 'critical' : 'high', 'vault-new', 'console', m.text.slice(0, 600))

// quick find
await page.keyboard.press('Meta+k')
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/shots/quickfind.png` })
const qfOpen = await page.locator('.quickfind, [class*="find"]').count()
report.quickFindNodes = qfOpen
await page.keyboard.press('Escape')
await page.waitForTimeout(200)
for (const m of consoleMsgs.splice(0)) note(m.type === 'pageerror' ? 'critical' : 'high', 'quickfind', 'console', m.text.slice(0, 600))

// mobile viewport pass
const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const mp = await mob.newPage()
const mobConsole = []
mp.on('console', (m) => { if (m.type() === 'error') mobConsole.push(m.text()) })
mp.on('pageerror', (e) => mobConsole.push(String(e)))
await mp.goto(BASE, { waitUntil: 'networkidle' })
await mp.waitForTimeout(800)
for (const v of VIEWS) {
  if (v !== 'home') {
    const el = mp.locator(`.nav-item:has-text("${LABELS[v]}")`).first()
    if (await el.count()) {
      const visible = await el.isVisible().catch(() => false)
      if (!visible) {
        // maybe inside Lainnya sheet
        const more = mp.locator('.nav-more-btn').first()
        if (await more.count()) {
          await more.click().catch(() => {})
          await mp.waitForTimeout(250)
          const el2 = mp.locator(`.more-sheet .nav-item:has-text("${LABELS[v]}")`).first()
          if (await el2.count()) await el2.click().catch(() => {})
          await mp.waitForTimeout(400)
        }
      } else {
        await el.click().catch(() => {})
        await mp.waitForTimeout(400)
      }
    }
  }
  await mp.screenshot({ path: `${OUT}/shots/m-${v}.png`, fullPage: false })
  const st = await mp.evaluate(() => ({
    docScrollW: document.documentElement.scrollWidth,
    docClientW: document.documentElement.clientWidth,
  }))
  if (st.docScrollW > st.docClientW + 1) {
    note('high', `mobile:${v}`, 'overflow', `Mobile meluber horizontal: ${st.docScrollW} > ${st.docClientW}`)
  }
}
for (const t of mobConsole.splice(0)) note('high', 'mobile', 'console', t.slice(0, 500))

writeFileSync(`${OUT}/audit.json`, JSON.stringify(report, null, 2))
console.log('\n=== FINDINGS ===')
console.log(JSON.stringify(findings, null, 2))
await browser.close()
