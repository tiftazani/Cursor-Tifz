// Measure the history row geometry in a real browser: do the username and the date
// still collide on one line, and is the date a real second line?
import { chromium } from 'playwright'

const base = 'http://127.0.0.1:5173/#preview-ui'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(base, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)

// Build the row exactly as EntryPane does, with the real stylesheet loaded.
const result = await page.evaluate(() => {
  const host = document.createElement('section')
  host.className = 'history-block'
  host.innerHTML = `
    <h3>Riwayat username &amp; password</h3>
    <ul><li>
      <div class="history-who"><strong>tifta</strong><span class="muted">9 Sep 2026, 09.03</span></div>
      <div class="row-actions"><button class="btn btn-ghost">Salin lama</button><button class="btn btn-ghost">Pakai lagi</button></div>
    </li></ul>`
  document.body.appendChild(host)
  const who = host.querySelector('.history-who')
  const strong = who.querySelector('strong')
  const muted = who.querySelector('.muted')
  const s = strong.getBoundingClientRect()
  const m = muted.getBoundingClientRect()
  const row = host.querySelector('li').getBoundingClientRect()
  const out = {
    usernameText: strong.textContent,
    dateText: muted.textContent,
    usernameBottom: +s.bottom.toFixed(1),
    dateTop: +m.top.toFixed(1),
    sameLine: Math.abs(s.top - m.top) < 4,
    overlap: s.bottom > m.top + 0.5 && m.left < s.right,
    gapPx: +(m.top - s.bottom).toFixed(1),
    dateFontPx: getComputedStyle(muted).fontSize,
    rowWidth: +row.width.toFixed(1),
    renderedText: who.textContent,
  }
  host.remove()
  return out
})

console.log(JSON.stringify(result, null, 2))
await browser.close()
