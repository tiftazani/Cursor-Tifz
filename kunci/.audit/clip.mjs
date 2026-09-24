// Hypothesis: .list-col is a flex column; .list-toolbar and .filter-row have no
// flex-shrink guard, so a long .entry-list squeezes them and the chip row is
// clipped (overflow:auto + hidden scrollbar). Reproduce by growing the list.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const OUT = '/Users/tiftazani/.hermes/cache/scratch/kunci-clip'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
await page.goto('http://127.0.0.1:5173/#preview-ui', { waitUntil: 'domcontentloaded' })
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1800)
await page.locator('.nav-item:has-text("Brankas")').first().click()
await page.waitForTimeout(700)

const measure = () => page.evaluate(() => {
  const g = (s) => { const n = document.querySelector(s); if (!n) return null; const b = n.getBoundingClientRect(); return { h: +b.height.toFixed(1), top: +b.top.toFixed(1), bot: +b.bottom.toFixed(1) } }
  const fr = document.querySelector('.filter-row')
  const chip = fr?.querySelector('.chip')
  const cs = fr ? getComputedStyle(fr) : null
  return {
    toolbar: g('.list-toolbar'), filterRow: g('.filter-row'), entryList: g('.entry-list'),
    chip: chip ? { h: +chip.getBoundingClientRect().height.toFixed(1), top: +chip.getBoundingClientRect().top.toFixed(1), bot: +chip.getBoundingClientRect().bottom.toFixed(1) } : null,
    filterFlex: cs ? { flex: cs.flex, minHeight: cs.minHeight, overflow: cs.overflowY, scrollH: fr.scrollHeight, clientH: fr.clientHeight } : null,
    searchInput: g('.search input'),
    clippedBy: chip && fr ? +(chip.getBoundingClientRect().bottom - fr.getBoundingClientRect().bottom).toFixed(1) : null,
  }
})

console.log('=== baseline (4 entries) ===')
console.log(JSON.stringify(await measure(), null, 1))

// Grow the list the way a real vault does: duplicate rows into the DOM.
for (const n of [8, 20, 40]) {
  await page.evaluate((count) => {
    const ul = document.querySelector('.entry-list')
    const proto = ul.querySelector('li')
    if (!proto) return
    // clear previous synthetic rows
    ;[...ul.querySelectorAll('li[data-synth]')].forEach((n) => n.remove())
    for (let i = 0; i < count; i++) {
      const c = proto.cloneNode(true)
      c.setAttribute('data-synth', '1')
      ul.appendChild(c)
    }
  }, n)
  await page.waitForTimeout(250)
  console.log(`\n=== after adding ${n} synthetic rows ===`)
  console.log(JSON.stringify(await measure(), null, 1))
  await page.screenshot({ path: `${OUT}/rows-${n}.png` })
  await page.screenshot({ path: `${OUT}/rows-${n}-listcol.png`, clip: { x: 220, y: 0, width: 300, height: 400 } })
}

await browser.close()
