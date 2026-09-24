import { chromium } from 'playwright'

const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()

await page.goto('http://127.0.0.1:5173/#preview-ui', { waitUntil: 'domcontentloaded' })
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)

await page.click('.nav-item:has-text("Brankas")')
await page.waitForSelector('.list-col', { timeout: 5000 })
await page.waitForTimeout(500)

const m = await page.evaluate(() => {
  const out = {}
  const row = document.querySelector('.filter-row')
  if (row) {
    out.filterRow = {
      clientWidth: row.clientWidth,
      scrollWidth: row.scrollWidth,
      overflowX: row.scrollWidth - row.clientWidth,
      scrollbarHidden: getComputedStyle(row).scrollbarWidth,
    }
    const chips = [...row.querySelectorAll('.chip')].map((c) => {
      const r = c.getBoundingClientRect()
      return { text: c.innerText, w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) }
    })
    out.chips = chips
    const rowRect = row.getBoundingClientRect()
    out.chipsCutOff = chips.filter((c) => c.right > Math.round(rowRect.right)).map((c) => c.text)
  }
  const search = document.querySelector('.search input')
  if (search) {
    out.search = {
      clientWidth: search.clientWidth,
      placeholder: search.placeholder,
      scrollWidth: search.scrollWidth,
      ariaLabel: search.getAttribute('aria-label'),
    }
  }
  const listCol = document.querySelector('.list-col')
  if (listCol) {
    const r = listCol.getBoundingClientRect()
    out.listCol = { w: Math.round(r.width), left: Math.round(r.left), right: Math.round(r.right) }
  }
  return out
})

console.log(JSON.stringify(m, null, 2))

// Settings measurements
await page.click('.nav-item:has-text("Pengaturan")')
await page.waitForSelector('.page', { timeout: 5000 })
await page.waitForTimeout(500)

const s = await page.evaluate(() => {
  const out = { inputs: [], labels: [] }
  for (const inp of document.querySelectorAll('.page .card input[type="number"], .page .card select.input, .page .card .input')) {
    const r = inp.getBoundingClientRect()
    out.inputs.push({ tag: inp.tagName, type: inp.type || '', w: Math.round(r.width), h: Math.round(r.height), value: inp.value })
  }
  const pageEl = document.querySelector('.page')
  if (pageEl) {
    const r = pageEl.getBoundingClientRect()
    out.page = { w: Math.round(r.width), maxWidth: getComputedStyle(pageEl).maxWidth }
  }
  for (const el of document.querySelectorAll('.field-label, .muted, .helper-chip')) {
    const cs = getComputedStyle(el)
    out.labels.push({ cls: el.className, color: cs.color, size: cs.fontSize, text: el.innerText.slice(0, 40) })
  }
  return out
})

console.log('=== SETTINGS ===')
console.log(JSON.stringify(s, null, 2))

await browser.close()