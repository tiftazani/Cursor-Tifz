import { chromium } from 'playwright'

const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text())
})

await page.goto('http://127.0.0.1:5173/#preview-ui', { waitUntil: 'domcontentloaded' })
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)

async function auditView(name, clickSel) {
  if (clickSel) {
    await page.click(clickSel)
    await page.waitForTimeout(700)
  }
  const res = await page.evaluate(() => {
    const small = []
    const unnamed = []
    const els = document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]')
    for (const el of els) {
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const label =
        el.getAttribute('aria-label') ||
        el.innerText?.trim() ||
        el.getAttribute('title') ||
        el.getAttribute('placeholder') ||
        (el.id ? document.querySelector(`label[for="${el.id}"]`)?.innerText : '') ||
        el.closest('label')?.innerText?.trim() ||
        ''
      const tag = el.tagName.toLowerCase()
      const type = el.getAttribute('type') || ''
      const id = `${tag}${type ? '[' + type + ']' : ''} "${String(label).slice(0, 34)}"`
      if (r.height < 24 || r.width < 24) {
        small.push({ id, w: Math.round(r.width), h: Math.round(r.height) })
      }
      if (!String(label).trim()) unnamed.push({ id, cls: el.className })
    }
    return { small, unnamed }
  })
  console.log(`\n===== ${name} =====`)
  console.log(`-- touch target < 24px (${res.small.length}) --`)
  for (const s of res.small) console.log(`   ${s.w}x${s.h}  ${s.id}`)
  console.log(`-- no accessible name (${res.unnamed.length}) --`)
  for (const u of res.unnamed) console.log(`   ${u.id} .${u.cls}`)
}

await auditView('home')
await auditView('vault', '.nav-item:has-text("Brankas")')
await auditView('generator', '.nav-item:has-text("Generator")')
await auditView('health', '.nav-item:has-text("Kesehatan")')
await auditView('history', '.nav-item:has-text("Riwayat")')
await auditView('autofill', '.nav-item:has-text("Autofill")')
await auditView('backup', '.nav-item:has-text("Cadangan")')
await auditView('settings', '.nav-item:has-text("Pengaturan")')

console.log('\n===== console/page errors =====')
for (const e of [...new Set(errors)]) console.log('  ' + e.slice(0, 300))

await browser.close()