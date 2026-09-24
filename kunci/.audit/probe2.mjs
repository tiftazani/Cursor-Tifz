import { chromium } from 'playwright'

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://127.0.0.1:5173/#preview-ui', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)
await page.locator('.nav-item:has-text("Brankas")').first().click()
await page.waitForTimeout(500)

const info = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.entry-row')]
  const urlTest = (s) => { try { return new URL(s.includes('://') ? s : 'https://' + s).hostname } catch (e) { return 'THROW:' + e.name } }
  return {
    rows: rows.map((r) => ({ strong: r.querySelector('strong')?.innerText, em: r.querySelector('em')?.innerText })),
    urlTest: {
      'PIN wifi': urlTest('PIN wifi'),
      'My Bank': urlTest('My Bank'),
      'rumah': urlTest('rumah'),
    },
    filterRow: (() => {
      const fr = document.querySelector('.filter-row')
      if (!fr) return null
      return { scrollW: fr.scrollWidth, clientW: fr.clientWidth, scrollable: fr.scrollWidth > fr.clientWidth }
    })(),
    searchPh: (() => {
      const i = document.querySelector('.search input')
      return i ? { ph: i.placeholder, w: i.clientWidth, sw: i.scrollWidth, aria: i.getAttribute('aria-label') } : null
    })(),
    sidebarNav: [...document.querySelectorAll('.sidebar .nav-item')].map((b) => b.innerText.trim()),
    detailCol: (() => {
      const d = document.querySelector('.detail-col')
      if (!d) return null
      const r = d.getBoundingClientRect()
      return { w: Math.round(r.width), h: Math.round(r.height) }
    })(),
    listCol: (() => {
      const d = document.querySelector('.list-col')
      if (!d) return null
      const r = d.getBoundingClientRect()
      return { w: Math.round(r.width) }
    })(),
  }
})
console.log(JSON.stringify(info, null, 2))

// check computed styles for contrast-critical tokens
const styles = await page.evaluate(() => {
  const cs = getComputedStyle(document.documentElement)
  const pick = ['--bg', '--bg-2', '--bg-3', '--text', '--muted', '--accent', '--accent-2', '--line']
  const out = {}
  for (const p of pick) out[p] = cs.getPropertyValue(p).trim()
  const linkish = document.querySelector('.linkish')
  const muted = document.querySelector('.sidebar-foot')
  const pill = document.querySelector('.pill')
  return {
    vars: out,
    linkish: linkish ? { color: getComputedStyle(linkish).color, fs: getComputedStyle(linkish).fontSize, h: Math.round(linkish.getBoundingClientRect().height) } : null,
    sidebarFoot: muted ? { color: getComputedStyle(muted).color, fs: getComputedStyle(muted).fontSize, h: Math.round(muted.getBoundingClientRect().height) } : null,
    pill: pill ? { color: getComputedStyle(pill).color, bg: getComputedStyle(pill).backgroundColor, fs: getComputedStyle(pill).fontSize } : null,
  }
})
console.log(JSON.stringify(styles, null, 2))
await browser.close()
