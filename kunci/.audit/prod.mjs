// Reproduce against the DEPLOYED production site the user is looking at,
// and against local dev, at the widths implied by their screenshot.
import { chromium } from 'playwright'

const browser = await chromium.launch({ channel: 'chrome' })

const TARGETS = [
  { name: 'prod', url: 'https://kunci-tifta.netlify.app' },
  { name: 'dev', url: 'http://127.0.0.1:5173/#preview-ui' },
]

for (const t of TARGETS) {
  for (const w of [1728, 1512, 1440, 1280]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2 })
    const page = await ctx.newPage()
    const errs = []
    page.on('pageerror', (e) => errs.push(e.message))
    await page.goto(t.url, { waitUntil: 'domcontentloaded' }).catch((e) => errs.push('goto ' + e.message))
    await page.waitForTimeout(3000)
    const body = (await page.evaluate(() => document.body.innerText.slice(0, 200))).replace(/\n/g, ' | ')
    console.log(`\n===== ${t.name} @ ${w} =====`)
    console.log('body:', body.slice(0, 160))
    const has = await page.locator('.nav-item:has-text("Brankas")').count()
    if (has) {
      await page.locator('.nav-item:has-text("Brankas")').first().click().catch(() => {})
      await page.waitForTimeout(900)
      const r = await page.evaluate(() => {
        const box = (s) => { const n = document.querySelector(s); if (!n) return null; const b = n.getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width), h: Math.round(b.height) } }
        const fr = document.querySelector('.filter-row')
        const chips = fr ? [...fr.querySelectorAll('.chip')].map((c) => { const b = c.getBoundingClientRect(); return { t: c.innerText, top: Math.round(b.top), bot: Math.round(b.bottom), h: Math.round(b.height), right: Math.round(b.right) } }) : []
        const el = document.querySelector('.entry-list')
        const frb = fr ? fr.getBoundingClientRect() : null
        return {
          sidebar: box('.sidebar'), listCol: box('.list-col'), detailCol: box('.detail-col'),
          toolbar: box('.list-toolbar'), filterRow: box('.filter-row'), entryList: box('.entry-list'),
          chips, chipH: chips[0]?.h, chipScroll: fr ? fr.scrollWidth - fr.clientWidth : null,
          firstListRow: box('.entry-row'),
          listTopMinusChipBottom: (el && frb) ? Math.round(el.getBoundingClientRect().top - frb.bottom) : null,
        }
      })
      console.log(JSON.stringify(r, null, 1))
      await page.screenshot({ path: `/Users/tiftazani/.hermes/cache/scratch/prod-${t.name}-${w}.png` })
    } else {
      console.log('vault not reachable (auth gate?)')
      await page.screenshot({ path: `/Users/tiftazani/.hermes/cache/scratch/prod-${t.name}-${w}.png` })
    }
    if (errs.length) console.log('errors:', errs.slice(0, 5))
    await ctx.close()
  }
}

await browser.close()
