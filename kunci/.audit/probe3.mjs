import { chromium } from 'playwright'

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

for (const url of ['http://127.0.0.1:5173/', 'http://127.0.0.1:5173/#preview-ui']) {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const info = await page.evaluate(() => ({
    hash: location.hash,
    text: document.body.innerText.slice(0, 300),
    classes: [...document.querySelectorAll('[class]')].slice(0, 25).map((e) => e.className),
  }))
  console.log('===', url)
  console.log('hash:', info.hash)
  console.log('text:', JSON.stringify(info.text))
  console.log('classes:', info.classes.join(' | '))
}

await browser.close()