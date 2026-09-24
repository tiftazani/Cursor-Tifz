import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const OUT = '/Users/tiftazani/.hermes/cache/scratch/kunci-audit'
mkdirSync(`${OUT}/shots`, { recursive: true })

async function main() {
  const browser = await chromium.launch({ channel: 'chrome' })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()

  await page.goto('http://127.0.0.1:5173/#preview-ui', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  // 1. Home / Dashboard
  await page.waitForSelector('.dash', { timeout: 5000 })
  await page.screenshot({ fullPage: true, path: `${OUT}/shots/final_home.png` })
  console.log('[shot] final_home.png')

  // 2. Vault
  await page.click('.nav-item:has-text("Brankas")')
  await page.waitForSelector('.list-col', { timeout: 5000 })
  await page.waitForTimeout(500)
  await page.screenshot({ fullPage: true, path: `${OUT}/shots/final_vault.png` })
  console.log('[shot] final_vault.png')

  // Check hint in list
  const listHints = await page.evaluate(() =>
    [...document.querySelectorAll('.entry-item .hint')].map((e) => e.innerText)
  )
  console.log('list hints:', listHints)

  // 3. Generator
  await page.click('.nav-item:has-text("Generator")')
  await page.waitForSelector('.gen-layout', { timeout: 5000 })
  await page.waitForTimeout(500)
  await page.screenshot({ fullPage: true, path: `${OUT}/shots/final_generator.png` })
  console.log('[shot] final_generator.png')

  // 4. Settings
  await page.click('.nav-item:has-text("Pengaturan")')
  await page.waitForSelector('.page', { timeout: 5000 })
  await page.waitForTimeout(500)
  await page.screenshot({ fullPage: true, path: `${OUT}/shots/final_settings.png` })
  console.log('[shot] final_settings.png')

  // Check cards in settings
  const settingsCards = await page.evaluate(() =>
    [...document.querySelectorAll('.page .card h3')].map((e) => e.innerText)
  )
  console.log('settings cards:', settingsCards)

  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})