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
page.on('dialog', (d) => { log(`   dialog: ${d.type()} "${d.message().slice(0, 80)}"`); void d.dismiss().catch(() => {}) })

await page.goto('http://127.0.0.1:5173/#preview-ui', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)

const VIEWS = ['Ringkasan', 'Brankas', 'Generator', 'Kesehatan', 'Riwayat', 'Autofill', 'Cadangan', 'Pengaturan']

// list buttons per view WITHOUT clicking (to see what exists)
for (const v of VIEWS) {
  await page.locator(`.nav-item:has-text("${v}")`).first().click().catch(() => {})
  await page.waitForTimeout(400)
  const btns = await page.evaluate(() =>
    [...document.querySelectorAll('.main-col button, .page button, .detail-col button')].map((b) => ({
      t: (b.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 50),
      c: String(b.className).slice(0, 40),
      dis: b.disabled,
      file: Boolean(b.closest('label')?.querySelector('input[type=file]')) || b.dataset.file != null,
    })),
  )
  log(`\n### ${v} (${btns.length} tombol)`)
  for (const b of btns) log(`   ${b.dis ? '[disabled] ' : ''}${b.t}${b.c ? '  <' + b.c + '>' : ''}`)
}

// ---- vault: new entry save with empty fields ----
log('\n### alur entri baru (Simpan kosong)')
await page.locator('.nav-item:has-text("Brankas")').first().click()
await page.waitForTimeout(400)
await page.locator('.toolbar-new').first().click()
await page.waitForTimeout(500)
const saveBtns = await page.evaluate(() =>
  [...document.querySelectorAll('.detail-col button')].map((b) => (b.innerText || '').replace(/\s+/g, ' ').trim()),
)
log('   detail buttons:', saveBtns.join(' | '))
const save = page.locator('.detail-col button').filter({ hasText: /Simpan|Buat|Tambah/i }).first()
if (await save.count()) {
  await save.click({ timeout: 3000 }).catch((e) => log('   klik err: ' + e.message.slice(0, 60)))
  await page.waitForTimeout(600)
  const after = await page.evaluate(() => {
    const d = document.querySelector('.detail-col')
    return d ? d.innerText.replace(/\s+/g, ' ').slice(0, 200) : ''
  })
  log(`   setelah simpan kosong: "${after}"`)
}
for (const e of bucket.splice(0)) note('high', 'Brankas/simpan-kosong', e.slice(0, 300))
await page.screenshot({ path: `${OUT}/shots/flow-new-save.png` })

writeFileSync(`${OUT}/findings-buttons.json`, JSON.stringify(findings, null, 2))
log(`\n=== FINDINGS (${findings.length}) ===`)
for (const f of findings) log(`[${f.sev}] ${f.where} :: ${f.msg}`)
await browser.close()
