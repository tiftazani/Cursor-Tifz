import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'node:fs'

const OUT = '/Users/tiftazani/.hermes/cache/scratch/kunci-audit'
mkdirSync(`${OUT}/shots`, { recursive: true })
const findings = []
const log = (...a) => console.log(...a)
function note(sev, where, msg, extra = {}) {
  findings.push({ sev, where, msg, ...extra })
  log(`[${sev}] ${where} :: ${msg}`)
}

const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
let bucket = []
page.on('console', (m) => { if (m.type() === 'error') bucket.push(`[console.error] ${m.text()}`) })
page.on('pageerror', (e) => bucket.push(`[pageerror] ${e.message}`))
page.on('dialog', async (d) => {
  log(`   dialog: ${d.type()} "${d.message()}"`)
  await d.dismiss().catch(() => {})
})

await page.goto('http://127.0.0.1:5173/#preview-ui', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)

const VIEWS = ['Ringkasan', 'Brankas', 'Generator', 'Kesehatan', 'Riwayat', 'Autofill', 'Cadangan', 'Pengaturan']

// ---------- sweep every button in every view ----------
for (const v of VIEWS) {
  await page.locator(`.nav-item:has-text("${v}")`).first().click().catch(() => {})
  await page.waitForTimeout(500)
  bucket = []

  const before = await page.evaluate(() => document.body.innerText.length)
  const btns = page.locator('.main-col button, .page button, .detail-col button')
  const n = await btns.count()
  log(`\n### ${v}: ${n} tombol`)

  for (let i = 0; i < n; i++) {
    const b = btns.nth(i)
    const label = (await b.innerText().catch(() => '')).replace(/\s+/g, ' ').trim().slice(0, 45)
    const cls = (await b.getAttribute('class').catch(() => '')) || ''
    if (!(await b.isVisible().catch(() => false))) continue
    if (!(await b.isEnabled().catch(() => false))) { log(`   [skip disabled] ${label}`); continue }

    const urlBefore = page.url()
    await b.click({ timeout: 3000 }).catch((e) => log(`   click err ${label}: ${e.message.slice(0, 60)}`))
    await page.waitForTimeout(320)

    const errs = bucket.splice(0)
    for (const e of errs) note('high', `${v} / klik "${label}" (${cls.slice(0, 30)})`, e.slice(0, 300))

    const after = await page.evaluate(() => document.body.innerText.length)
    const changed = after !== before || page.url() !== urlBefore
    log(`   ${changed ? '✓' : '·'} ${label}${cls ? ' [' + cls.slice(0, 24) + ']' : ''}${changed ? ` (text ${before}->${after})` : ' (tidak ada perubahan terlihat)'}`)
    if (!changed) note('low', `${v} / "${label}"`, `klik tidak mengubah apa pun yang terlihat (kls: ${cls})`)
  }
  for (const e of bucket.splice(0)) note('high', v, e.slice(0, 300))
}

// ---------- vault: new entry save flow ----------
log('\n### alur entri baru')
await page.locator('.nav-item:has-text("Brankas")').first().click()
await page.waitForTimeout(400)
await page.locator('.toolbar-new, .btn:has-text("Baru")').first().click()
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/shots/flow-new.png` })
const paneBtns = await page.locator('.detail-col button').allInnerTexts().catch(() => [])
log('   detail buttons:', paneBtns.map((s) => s.replace(/\s+/g, ' ').trim()).join(' | '))

// try save with empty fields
for (const name of [/Simpan/i, /Buat/i]) {
  const btn = page.locator('.detail-col button').filter({ hasText: name }).first()
  if (await btn.count()) {
    await btn.click().catch(() => {})
    await page.waitForTimeout(500)
    const err = await page.locator('.detail-col .error, .toast').innerText().catch(() => '')
    log(`   simpan kosong -> "${err.replace(/\s+/g, ' ').slice(0, 120)}"`)
    for (const e of bucket.splice(0)) note('high', 'Brankas/simpan-kosong', e.slice(0, 300))
    break
  }
}
await page.screenshot({ path: `${OUT}/shots/flow-new-save.png` })

// ---------- generator: regenerate / copy ----------
log('\n### generator')
await page.locator('.nav-item:has-text("Generator")').first().click()
await page.waitForTimeout(500)
const gen0 = await page.locator('.main-col').innerText()
const regen = page.locator('.main-col button').filter({ hasText: /Acak lagi|Ulang/i }).first()
if (await regen.count()) {
  const pwBefore = await page.evaluate(() => document.querySelector('.pw-output, .gen-out, code, .mono')?.innerText || '')
  await regen.click().catch(() => {})
  await page.waitForTimeout(400)
  const pwAfter = await page.evaluate(() => document.querySelector('.pw-output, .gen-out, code, .mono')?.innerText || '')
  log(`   regenerate: ${pwBefore === pwAfter ? 'TIDAK BERUBAH (bug?)' : 'berubah ok'}`)
  if (pwBefore === pwAfter && pwBefore) note('high', 'Generator', 'tombol Acak lagi tidak mengubah password')
}
// length slider extremes
const slider = page.locator('input[type=range]').first()
if (await slider.count()) {
  for (const val of ['4', '8', '64', '128']) {
    await slider.fill(val).catch(() => {})
    await page.waitForTimeout(250)
    const txt = await page.evaluate(() => {
      const c = document.querySelector('.pw-output, .gen-out, code')
      return c ? { v: c.innerText.trim(), len: c.innerText.trim().length } : null
    })
    log(`   slider=${val} -> ${JSON.stringify(txt)}`)
    for (const e of bucket.splice(0)) note('high', `Generator/slider=${val}`, e.slice(0, 300))
  }
}
// uncheck all rules
const checks = page.locator('.main-col input[type=checkbox]')
const cn = await checks.count()
for (let i = 0; i < cn; i++) {
  await checks.nth(i).uncheck().catch(() => {})
}
await page.waitForTimeout(400)
const out = await page.evaluate(() => {
  const c = document.querySelector('.pw-output, .gen-out, code')
  return c ? c.innerText.trim() : ''
})
log(`   semua aturan dimatikan -> output: "${out}" (len ${out.length})`)
if (!out) note('high', 'Generator', 'semua aturan karakter dimatikan menghasilkan output kosong tanpa pesan')
for (const e of bucket.splice(0)) note('high', 'Generator/rules-off', e.slice(0, 300))
await page.screenshot({ path: `${OUT}/shots/flow-gen-off.png` })

writeFileSync(`${OUT}/findings2.json`, JSON.stringify(findings, null, 2))
log(`\n=== FINDINGS (${findings.length}) ===`)
for (const f of findings) log(`[${f.sev}] ${f.where} :: ${f.msg}`)
await browser.close()
