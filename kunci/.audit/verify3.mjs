import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const OUT = '/Users/tiftazani/.hermes/cache/scratch/kunci-audit/shots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome' })

// re-check mobile overflow after code fix
console.log('===== R-03 mobile overflow (after fix) =====')
for (const vp of [
  { width: 390, height: 844, name: 'iPhone 390' },
  { width: 320, height: 568, name: 'iPhone SE 320' },
]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
  const page = await ctx.newPage()
  await page.goto('http://127.0.0.1:5173/#preview-ui', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  const bad = []
  for (const v of ['Ringkasan', 'Brankas', 'Generator', 'Kesehatan', 'Riwayat', 'Autofill', 'Cadangan', 'Pengaturan']) {
    const moreBtn = await page.$('.nav-more-btn')
    const nav = await page.$(`.nav-item:has-text("${v}")`)
    if (nav && (await nav.isVisible())) await nav.click().catch(() => {})
    else if (moreBtn) {
      await moreBtn.click().catch(() => {})
      await page.waitForTimeout(250)
      const s = await page.$(`.more-sheet .nav-item:has-text("${v}")`)
      if (s) await s.click().catch(() => {})
    }
    await page.waitForTimeout(450)
    const r = await page.evaluate(() => {
      const de = document.documentElement
      const esc = []
      for (const el of document.querySelectorAll('.page *, .list-col *, .card *')) {
        const rect = el.getBoundingClientRect()
        if (rect.width === 0) continue
        if (rect.right > de.clientWidth + 2)
          esc.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 24)} right=${Math.round(rect.right)} "${(el.innerText || '').slice(0, 22)}"`)
      }
      return { overflowX: de.scrollWidth - de.clientWidth, clientWidth: de.clientWidth, esc: esc.slice(0, 5) }
    })
    if (r.overflowX > 0 || r.esc.length) bad.push({ view: v, ...r })
  }
  console.log(`${vp.name}: ${bad.length === 0 ? 'CLEAN' : bad.length + ' bermasalah'}`)
  for (const b of bad) {
    console.log(`   [${b.view}] overflowX=${b.overflowX} client=${b.clientWidth}`)
    for (const e of b.esc) console.log(`      ${e}`)
  }
  await page.screenshot({ fullPage: true, path: `${OUT}/mobile_${vp.width}_vault.png` })
  await ctx.close()
}

// Re-shot desktop views after all fixes
console.log('\n===== desktop re-shot =====')
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.goto('http://127.0.0.1:5173/#preview-ui', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  for (const [name, sel, wait] of [
    ['home', null, '.dash'],
    ['vault', '.nav-item:has-text("Brankas")', '.list-col'],
    ['generator', '.nav-item:has-text("Generator")', '.gen-layout'],
    ['autofill', '.nav-item:has-text("Autofill")', '.page'],
    ['settings', '.nav-item:has-text("Pengaturan")', '.page'],
  ]) {
    if (sel) {
      const el = await page.$(sel)
      if (el) await el.click()
      await page.waitForTimeout(600)
    }
    await page.waitForSelector(wait, { timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(300)
    await page.screenshot({ fullPage: true, path: `${OUT}/v2_${name}.png` })
    console.log(`[shot] v2_${name}.png`)
  }

  // nested button inside label check (dashboard duplicate radio + linkish)
  const nested = await page.evaluate(() => {
    const btn = document.querySelector('label.check button.linkish')
    return btn ? 'ADA button di dalam label.check' : 'tidak ada'
  })
  console.log('nested control:', nested)
  await ctx.close()
}

await browser.close()