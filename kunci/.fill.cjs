
const { chromium } = require('playwright')
const path = require('node:path'); const os = require('node:os'); const fs = require('node:fs')
const EXT = '/Users/tiftazani/Documents/Hermes-AI/Kunci/kunci/extension'
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kunci-ext-'))
;(async () => {
  const ctx = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--no-first-run'],
    viewport: { width: 1440, height: 900 },
  })
  let [sw] = ctx.serviceWorkers()
  if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 30000 })
  const extId = new URL(sw.url()).host
  const seed = await ctx.newPage()
  await seed.goto(`chrome-extension://${extId}/popup.html`)
  await seed.evaluate(async () => {
    const mod = await import('./crypto.js')
    const dek = crypto.getRandomValues(new Uint8Array(32))
    const mk = (n, u) => ({ id: n, name: n, username: u, password: 'P-' + n, url: 'https://www.agoda.com/', type: 'login' })
    const vault = { v: 1, entries: [
      mk('Agoda Satu','satu@example.com'), mk('Agoda Dua','dua@example.com'),
      mk('Agoda Tiga','tiga@example.com'), mk('Agoda Empat','empat@example.com'),
      mk('Agoda Lima','lima@example.com'),
    ], settings: { autoFillWeb: true, offerSaveWeb: true } }
    const blob = await mod.persistVault(vault, dek, { v:2, iv:'', data:'', savedAt:0 })
    await chrome.storage.local.set({ blob })
    await chrome.storage.session.set({ unlocked: true, dekB64: mod.dekToB64(dek) })
  })
  await seed.close()

  const page = await ctx.newPage()
  await page.goto('https://www.agoda.com/account/signin.html', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(6000)
  for (const b of await page.$$('button, [role=button], a')) {
    const t = ((await b.textContent()) || '').trim()
    if (/^sign in$/i.test(t)) { await b.click().catch(()=>{}); break }
  }
  await page.waitForTimeout(10000)

  const login = page.frames().find(f => /\/ul\/login/.test(f.url()))
  // The iframe's own position on the page: the bar's coordinates are relative to the
  // FRAME viewport, so a page-level click needs the frame offset added.
  const frameBox = await page.evaluate(() => {
    const f = [...document.querySelectorAll('iframe')].find(x => (x.src||'').includes('ul/login'))
    const r = f.getBoundingClientRect()
    return { x: r.left, y: r.top, w: r.width, h: r.height }
  })
  console.log('iframe di halaman:', JSON.stringify(frameBox))

  const barRect = await login.evaluate(() => {
    const bar = document.querySelector('[data-kunci-bar]')
    const r = bar.getBoundingClientRect()
    return { top: r.top, left: r.left, w: r.width, h: r.height }
  })
  console.log('bar di dalam frame:', JSON.stringify(barRect))

  const cx = Math.round(frameBox.x + barRect.left + barRect.w / 2)
  const results = []
  for (const dy of [72, 88, 104, 120, 136, 152]) {
    const y = Math.round(frameBox.y + barRect.top + dy)
    const gone = await login.evaluate(() => !document.querySelector('[data-kunci-bar]'))
    if (gone) break
    await page.mouse.click(cx, y)
    await page.waitForTimeout(800)
    const val = await login.$eval('input[type=email]', el => el.value).catch(() => '(kotak hilang)')
    const nowGone = await login.evaluate(() => !document.querySelector('[data-kunci-bar]'))
    results.push([dy, JSON.stringify(val), nowGone ? 'bar tertutup' : 'bar masih ada'])
    if (nowGone) break
  }
  console.log('HASIL KLIK (y = offset dari atas bar):')
  for (const r of results) console.log('  +', r.join('   '))
  await page.screenshot({ path: '/Users/tiftazani/.hermes/cache/scratch/agoda-filled.png' })
  await ctx.close(); fs.rmSync(userDataDir, { recursive: true, force: true })
})()
