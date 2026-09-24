// Prove the measurement distinguishes broken from fixed: render the same row with and
// without the .history-who wrapper and compare.
import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://127.0.0.1:5173/#preview-ui', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)

const measure = await page.evaluate(() => {
  function build(withClass) {
    const host = document.createElement('section')
    host.className = 'history-block'
    const cls = withClass ? ' class="history-who"' : ''
    host.innerHTML = `<ul><li>
      <div${cls}><strong>tifta</strong><span class="muted">9 Sep 2026, 09.03</span></div>
      <div class="row-actions"><button class="btn btn-ghost">Salin lama</button></div>
    </li></ul>`
    document.body.appendChild(host)
    const who = host.querySelector('div')
    const s = who.querySelector('strong').getBoundingClientRect()
    const m = who.querySelector('.muted').getBoundingClientRect()
    host.remove()
    return { sameLine: Math.abs(s.top - m.top) < 4, gapPx: +(m.top - s.bottom).toFixed(1) }
  }
  return { old: build(false), fixed: build(true) }
})

console.log(JSON.stringify(measure, null, 2))
const ok = measure.old.sameLine === true && measure.fixed.sameLine === false
console.log(ok ? 'PASS: measurement catches the old layout and clears the new one' : 'FAIL: measurement cannot tell them apart')
await browser.close()
process.exit(ok ? 0 : 1)
