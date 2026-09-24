// Precise geometry probe for the reported chip-row clipping.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const OUT = '/Users/tiftazani/.hermes/cache/scratch/kunci-hunt/shots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome' })

for (const theme of ['dark', 'light']) {
  for (const w of [1440, 1280, 1100, 900, 390]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 } })
    const page = await ctx.newPage()
    await page.goto('http://127.0.0.1:5173/#preview-ui', { waitUntil: 'domcontentloaded' })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1800)
    await page.evaluate((t) => { document.documentElement.dataset.theme = t }, theme)
    await page.waitForTimeout(200)

    const hasVault = await page.locator('.nav-item:has-text("Brankas")').count()
    if (hasVault) { await page.locator('.nav-item:has-text("Brankas")').first().click(); await page.waitForTimeout(600) }

    const r = await page.evaluate(() => {
      const g = (s) => { const n = document.querySelector(s); if (!n) return null; const b = n.getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width), h: Math.round(b.height) } }
      const fr = document.querySelector('.filter-row')
      const chips = fr ? [...fr.querySelectorAll('.chip')].map((c) => { const b = c.getBoundingClientRect(); return { txt: c.innerText, l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom) } }) : []
      const frb = fr ? fr.getBoundingClientRect() : null
      return {
        filterRow: g('.filter-row'), toolbar: g('.list-toolbar'), entryList: g('.entry-list'),
        listCol: g('.list-col'), detailCol: g('.detail-col'), sidebar: g('.sidebar'),
        chips, chipsVisible: frb ? chips.filter((c) => c.r <= frb.right + 1).map((c) => c.txt) : [],
        chipsClipped: frb ? chips.filter((c) => c.r > frb.right + 1).map((c) => c.txt) : [],
        filterScroll: fr ? fr.scrollWidth - fr.clientWidth : null,
        mask: fr ? getComputedStyle(fr).maskImage.slice(0, 80) : null,
        // does entry-list overlap filter-row vertically?
        gapToolbarFilter: null,
      }
    })
    // vertical gap between filter row bottom and list top
    if (r.filterRow && r.entryList) r.gapFilterToList = r.entryList.t - r.filterRow.b
    if (r.toolbar && r.filterRow) r.gapToolbarToFilter = r.filterRow.t - r.toolbar.b

    console.log(`\n=== ${theme} ${w}px ===`)
    console.log(`sidebar ${r.sidebar?.w} | listCol ${r.listCol?.w} | detailCol ${r.detailCol?.w}`)
    console.log(`toolbar ${JSON.stringify(r.toolbar)}`)
    console.log(`filterRow ${JSON.stringify(r.filterRow)}  scrollOverflow=${r.filterScroll}`)
    console.log(`entryList ${JSON.stringify(r.entryList)}`)
    console.log(`gap toolbar->filter=${r.gapToolbarToFilter} filter->list=${r.gapFilterToList}`)
    console.log(`chips visible: ${r.chipsVisible.join(', ')}`)
    console.log(`chips CLIPPED: ${r.chipsClipped.join(', ')}`)
    await page.screenshot({ path: `${OUT}/geo-${theme}-${w}.png`, clip: { x: r.listCol?.l ?? 0, y: 0, width: r.listCol?.w ?? 300, height: 320 } })
    await ctx.close()
  }
}

await browser.close()
