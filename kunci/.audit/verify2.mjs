import { chromium } from 'playwright'

const browser = await chromium.launch({ channel: 'chrome' })

async function boot(viewport) {
  const ctx = await browser.newContext({ viewport })
  const page = await ctx.newPage()
  await page.goto('http://127.0.0.1:5173/#preview-ui', { waitUntil: 'domcontentloaded' })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  return { ctx, page }
}

// ---------- 1. Mobile overflow (R-03) ----------
console.log('===== R-03 mobile overflow =====')
for (const vp of [
  { width: 390, height: 844, name: 'iPhone 390' },
  { width: 320, height: 568, name: 'iPhone SE 320' },
  { width: 768, height: 1024, name: 'iPad 768' },
]) {
  const { ctx, page } = await boot({ width: vp.width, height: vp.height })
  const views = ['Ringkasan', 'Brankas', 'Generator', 'Kesehatan', 'Riwayat', 'Autofill', 'Cadangan', 'Pengaturan']
  const bad = []
  for (const v of views) {
    const moreBtn = await page.$('.nav-more-btn')
    const nav = await page.$(`.nav-item:has-text("${v}")`)
    if (nav && (await nav.isVisible())) {
      await nav.click().catch(() => {})
    } else if (moreBtn) {
      await moreBtn.click().catch(() => {})
      await page.waitForTimeout(300)
      const sheet = await page.$(`.more-sheet .nav-item:has-text("${v}")`)
      if (sheet) await sheet.click().catch(() => {})
    }
    await page.waitForTimeout(500)
    const r = await page.evaluate(() => {
      const de = document.documentElement
      const overflowX = de.scrollWidth - de.clientWidth
      const escapees = []
      for (const el of document.querySelectorAll('.page *, .list-col *, .card *')) {
        const rect = el.getBoundingClientRect()
        if (rect.width === 0) continue
        if (rect.right > de.clientWidth + 2) {
          escapees.push({
            tag: el.tagName.toLowerCase(),
            cls: String(el.className).slice(0, 40),
            right: Math.round(rect.right),
            text: (el.innerText || '').slice(0, 25),
          })
        }
      }
      return { overflowX, clientWidth: de.clientWidth, escapees: escapees.slice(0, 6) }
    })
    if (r.overflowX > 0 || r.escapees.length) {
      bad.push({ view: v, ...r })
    }
  }
  console.log(`${vp.name}: ${bad.length === 0 ? 'CLEAN' : bad.length + ' view bermasalah'}`)
  for (const b of bad) {
    console.log(`   [${b.view}] overflowX=${b.overflowX} (client ${b.clientWidth})`)
    for (const e of b.escapees) console.log(`      ${e.tag}.${e.cls} right=${e.right} "${e.text}"`)
  }
  await ctx.close()
}

// ---------- 2. Keyboard focus (R-32) ----------
console.log('\n===== R-32 keyboard =====')
{
  const { ctx, page } = await boot({ width: 1440, height: 900 })
  const noFocus = await page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('button, a[href], input, select, textarea')) {
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      const r = el.getBoundingClientRect()
      if (r.width === 0) continue
      const focusRule = cs.outlineStyle === 'none' && cs.outlineWidth === '0px' && !cs.boxShadow.includes('rgb')
      out.push({
        tag: el.tagName.toLowerCase(),
        label: (el.getAttribute('aria-label') || el.innerText || el.placeholder || '').slice(0, 30),
        outlineStyle: cs.outlineStyle,
        outlineWidth: cs.outlineWidth,
      })
    }
    return out
  })
  // Tab through and record the focused element sequence
  const seq = []
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab')
    const f = await page.evaluate(() => {
      const el = document.activeElement
      if (!el) return null
      const cs = getComputedStyle(el)
      return {
        tag: el.tagName.toLowerCase(),
        label: (el.getAttribute('aria-label') || el.innerText || el.placeholder || '').slice(0, 32),
        outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`,
        boxShadow: cs.boxShadow.slice(0, 40),
      }
    })
    if (f) seq.push(f)
  }
  console.log('Tab order (12 pertama):')
  for (const s of seq) console.log(`   ${s.tag.padEnd(8)} outline=${s.outline.padEnd(28)} "${s.label}"`)
  await ctx.close()
}

// ---------- 3. Light theme (R-34) ----------
console.log('\n===== R-34 tema terang =====')
{
  const { ctx, page } = await boot({ width: 1440, height: 900 })
  await page.click('.nav-item:has-text("Pengaturan")')
  await page.waitForTimeout(600)
  const sel = await page.$('.page .card:has-text("Tampilan") select')
  if (sel) {
    await sel.selectOption('light')
    await page.waitForTimeout(900)
  }
  const theme = await page.evaluate(() => document.documentElement.dataset.theme)
  const res = await page.evaluate(() => {
    function parse(c) {
      const m = c.match(/rgba?\(([^)]+)\)/)
      if (!m) return null
      const p = m[1].split(',').map((x) => parseFloat(x))
      return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }
    }
    function lum({ r, g, b }) {
      const f = (v) => {
        v /= 255
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
      }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    function bgOf(el) {
      let cur = el
      while (cur) {
        const c = parse(getComputedStyle(cur).backgroundColor)
        if (c && c.a > 0) return c
        cur = cur.parentElement
      }
      return { r: 255, g: 255, b: 255, a: 1 }
    }
    function ratio(fg, bg) {
      const a = fg.a
      const f = { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a) }
      const l1 = lum(f)
      const l2 = lum(bg)
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
    }
    const out = []
    for (const [sel, label] of [
      ['.muted', 'muted'],
      ['.field-label', 'field label'],
      ['.card h3', 'card h3'],
      ['.nav-item', 'nav item'],
      ['.chip', 'chip'],
      ['.check', 'check'],
    ]) {
      const el = document.querySelector(sel)
      if (!el) continue
      const cs = getComputedStyle(el)
      const fg = parse(cs.color)
      const bg = bgOf(el)
      if (!fg) continue
      const r = Math.round(ratio(fg, bg) * 100) / 100
      const need = parseFloat(cs.fontSize) >= 18 ? 3 : 4.5
      out.push({ label, ratio: r, need, ok: r >= need, fg: cs.color, bg: `rgb(${bg.r},${bg.g},${bg.b})` })
    }
    return out
  })
  console.log('theme aktif:', theme)
  for (const s of res) console.log(`${s.ok ? 'PASS' : 'FAIL'} ${String(s.ratio).padStart(6)} (need ${s.need}) ${s.label} fg ${s.fg} bg ${s.bg}`)
  await page.screenshot({ fullPage: true, path: '/Users/tiftazani/.hermes/cache/scratch/kunci-audit/shots/final_light_settings.png' })
  await ctx.close()
}

await browser.close()