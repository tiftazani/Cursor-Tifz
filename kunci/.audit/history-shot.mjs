// Before/after screenshot of the history row using the app's real stylesheet.
import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 420 }, deviceScaleFactor: 2 })
await page.goto('http://127.0.0.1:5173/#preview-ui', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)

const shot = await page.evaluate(() => {
  const wrap = document.createElement('div')
  wrap.style.cssText = 'position:fixed;inset:0;z-index:99999;background:var(--bg);padding:20px 24px;font-family:inherit'
  wrap.innerHTML = `
    <p style="margin:0 0 10px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)">Sebelum — tanpa .history-who</p>
    <section class="history-block"><ul><li>
      <div><strong>tifta</strong><span class="muted">9 Sep 2026, 09.03</span></div>
      <div class="row-actions"><button class="btn btn-ghost">Salin lama</button><button class="btn btn-ghost">Pakai lagi</button></div>
    </li></ul></section>
    <p style="margin:26px 0 10px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)">Sesudah — dengan .history-who</p>
    <section class="history-block"><ul><li>
      <div class="history-who"><strong>tifta</strong><span class="muted">9 Sep 2026, 09.03</span></div>
      <div class="row-actions"><button class="btn btn-ghost">Salin lama</button><button class="btn btn-ghost">Pakai lagi</button></div>
    </li></ul></section>`
  document.body.appendChild(wrap)
  return true
})

await page.screenshot({ path: '/Users/tiftazani/.hermes/cache/scratch/history-before-after.png' })
console.log('shot:', shot)
await browser.close()
