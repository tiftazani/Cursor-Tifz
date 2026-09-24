import { chromium } from 'playwright'

const browser = await chromium.launch({ channel: 'chrome' })

async function testMask(vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
  const page = await ctx.newPage()
  await page.goto('http://127.0.0.1:5173/#preview-ui', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  // click Brankas
  await page.click('.nav-item:has-text("Brankas")')
  await page.waitForTimeout(600)

  const res = await page.evaluate(() => {
    const row = document.querySelector('.filter-row')
    if (!row) return { mask: 'NO filter-row' }
    const cs = getComputedStyle(row)
    const chips = [...row.querySelectorAll('.chip')].map(c => {
      const r = c.getBoundingClientRect()
      return { text: c.innerText, right: Math.round(r.right), width: Math.round(r.width) }
    })
    return {
      clientWidth: row.clientWidth,
      maskImage: cs.maskImage || cs.webkitMaskImage || 'NONE',
      maskPosition: cs.maskPosition || cs.webkitMaskPosition || 'NONE',
      maskRepeat: cs.maskRepeat || cs.webkitMaskRepeat || 'NONE',
      chips,
    }
  })

  await page.screenshot({ fullPage: true, path: `/Users/tiftazani/.hermes/cache/scratch/kunci-audit/shots/mask_${vp.width}.png` })
  await ctx.close()
  return { vp, ...res }
}

for (const vp of [
  { width: 390, height: 844 },
  { width: 320, height: 568 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
]) {
  const r = await testMask(vp)
  console.log(`\n=== ${r.vp.width} ===`)
  console.log('mask:', r.maskImage, '|', r.maskPosition, '|', r.maskRepeat)
  console.log(`clientWidth: ${r.clientWidth}`)
  for (const c of r.chips) console.log(`   ${c.text.padEnd(10)} right=${c.right} w=${c.width}`)
}

await browser.close()