import { chromium } from 'playwright'

const browser = await chromium.launch({ channel: 'chrome' })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })

const page = await ctx.newPage()
await page.goto('http://127.0.0.1:5173/#preview-ui', { waitUntil: 'domcontentloaded' })
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)

const info = await page.evaluate(() => ({
  hash: location.hash,
  text: document.body.innerText.slice(0, 400),
  classes: [...document.querySelectorAll('[class]')].slice(0, 30).map((e) => e.className),
}))

console.log('hash:', info.hash)
console.log('text:', JSON.stringify(info.text))
console.log('classes:', info.classes.join(' | '))

await browser.close()