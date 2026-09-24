// Verify the light-theme CSS variable gap and nested-interactive bugs directly.
import { chromium } from 'playwright'

const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
await page.goto('http://127.0.0.1:5173/#preview-ui', { waitUntil: 'domcontentloaded' })
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1800)

for (const theme of ['dark', 'light']) {
  await page.evaluate((t) => { document.documentElement.dataset.theme = t }, theme)
  await page.waitForTimeout(200)
  const vars = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement)
    const names = ['--bg', '--bg-2', '--bg-3', '--text', '--muted', '--accent', '--accent-text', '--accent-2', '--danger', '--warn', '--ok', '--accent-dim']
    const o = {}
    for (const n of names) o[n] = cs.getPropertyValue(n).trim()
    return o
  })
  console.log(`\n=== ${theme} theme vars ===`)
  console.log(JSON.stringify(vars, null, 1))
  // is each var defined in the light block, or inherited from :root?
  const defined = await page.evaluate(() => {
    const out = {}
    for (const sheet of document.styleSheets) {
      let rules
      try { rules = sheet.cssRules } catch { continue }
      for (const rule of rules) {
        if (rule.selectorText === ":root[data-theme='light']") {
          for (const p of rule.style) out[p] = rule.style.getPropertyValue(p).trim()
        }
      }
    }
    return out
  })
  if (theme === 'light') {
    console.log('explicitly set in :root[data-theme=light]:', Object.keys(defined).join(', '))
    const all = ['--bg','--bg-2','--bg-3','--bg-hover','--line','--text','--muted','--accent','--accent-dim','--accent-text','--accent-2','--danger','--warn','--ok','--shadow']
    console.log('MISSING from light block:', all.filter((v) => !(v in defined)).join(', '))
  }
}

// nested interactive check
await page.locator('.nav-item:has-text("Ringkasan")').first().click()
await page.waitForTimeout(700)
const nested = await page.evaluate(() => {
  const out = []
  for (const a of document.querySelectorAll('button, a[href], label')) {
    const inner = a.querySelector('button, a[href], input, select, textarea')
    if (inner) out.push(a.tagName + '.' + String(a.className).slice(0, 40) + ' > ' + inner.tagName + '.' + String(inner.className).slice(0, 30) + ' text="' + (a.innerText || '').slice(0, 40).replace(/\n/g, ' ') + '"')
  }
  return out
})
console.log('\n=== nested interactive ===')
console.log(nested.length ? nested.join('\n') : 'none')

// clicking the inner link: does it also toggle the radio?
if (nested.length) {
  const before = await page.evaluate(() => [...document.querySelectorAll('.dupe-members input[type=radio]')].map((r) => r.checked))
  await page.locator('label.check button.linkish').first().click()
  await page.waitForTimeout(500)
  const after = await page.evaluate(() => [...document.querySelectorAll('.dupe-members input[type=radio]')].map((r) => r.checked))
  console.log('radio state before:', before, 'after clicking inner linkish:', after)
  console.log('view after click:', await page.evaluate(() => document.querySelector('.page h2')?.innerText || document.body.innerText.slice(0, 60).replace(/\n/g, ' ')))
}

await browser.close()
