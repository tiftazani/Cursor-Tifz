// Load the real unpacked extension in Chromium and see whether the Kunci icon appears
// next to a password field, on a classic login page and on an Agoda-style two-step page.
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const EXT = '/Users/tiftazani/Documents/Hermes-AI/Kunci/kunci/extension'

const classic = `<!doctype html><html><body>
<form id="login"><input type="email" name="email" autocomplete="username">
<input type="password" name="password" autocomplete="current-password">
<button type="submit">Masuk</button></form></body></html>`

// Agoda-style: email only, Continue reveals the password step.
const agoda = `<!doctype html><html><body>
<form id="signin"><input type="email" name="email" id="email" placeholder="id@email.com">
<button type="button" id="go">Continue</button></form>
<script>
document.getElementById('go').addEventListener('click', () => {
  setTimeout(() => {
    const f = document.getElementById('signin')
    const p = document.createElement('input')
    p.type = 'password'; p.name = 'password'; p.autocomplete = 'current-password'
    f.insertBefore(p, document.getElementById('go'))
  }, 600)
})
</script></body></html>`

const server = createServer((req, res) => {
  res.setHeader('content-type', 'text/html')
  res.end(req.url === '/agoda' ? agoda : classic)
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const port = server.address().port

const userDataDir = mkdtempSync(join(tmpdir(), 'kunci-prof-'))
const ctx = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--no-first-run'],
})

async function probe(path) {
  const page = await ctx.newPage()
  await page.goto(`http://127.0.0.1:${port}${path}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  if (path === '/agoda') {
    await page.click('#go')
    await page.waitForTimeout(2500)
  }
  return page.evaluate(() => {
    const pw = [...document.querySelectorAll('input[type="password"]')]
    const icons = [...document.querySelectorAll('.kunci-icon-host, [id^="kunci-icon-"]')]
    return {
      passwordFields: pw.length,
      icons: icons.length,
      iconVisible: icons.some((h) => h.style.display !== 'none' && h.getBoundingClientRect().width > 0),
      iconRect: icons[0]?.getBoundingClientRect().toJSON() ?? null,
      pwRect: pw[0]?.getBoundingClientRect().toJSON() ?? null,
    }
  })
}

console.log('classic login page :', JSON.stringify(await probe('/classic')))
console.log('agoda-style page   :', JSON.stringify(await probe('/agoda')))

await ctx.close()
server.close()
