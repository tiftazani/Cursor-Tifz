// Live proof: on an Agoda-style page (email only, no password box yet),
// the Kunci icon must now appear next to the email field BEFORE "Continue" is clicked.
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const EXT = '/Users/tiftazani/Documents/Hermes-AI/Kunci/kunci/extension'

// Matches the real Agoda sign-in page: /account/signin.html, email box, Continue button.
const agoda = `<!doctype html><html><body>
<form id="signin" action="/account/signin.html">
  <h2>Sign in or create an account</h2>
  <input type="email" name="email" id="email" placeholder="id@email.com">
  <button type="button" id="go">Continue</button>
</form></body></html>`

const server = createServer((req, res) => {
  res.setHeader('content-type', 'text/html')
  res.end(agoda)
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const port = server.address().port

const userDataDir = mkdtempSync(join(tmpdir(), 'kunci-agoda-'))
const ctx = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--no-first-run'],
})

const page = await ctx.newPage()
await page.goto(`http://127.0.0.1:${port}/account/signin.html`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2500)

const state = await page.evaluate(() => {
  const pw = [...document.querySelectorAll('input[type="password"]')]
  const email = document.querySelector('input[type="email"]')
  const icons = [...document.querySelectorAll('.kunci-icon-host, [id^="kunci-icon-"]')]
  return {
    passwordFields: pw.length,
    hasEmailBox: Boolean(email),
    iconsFound: icons.length,
    iconVisible: icons.some((h) => h.style.display !== 'none' && h.getBoundingClientRect().width > 0),
    iconNearEmail: (() => {
      if (!email || !icons[0]) return false
      const er = email.getBoundingClientRect()
      const ir = icons[0].getBoundingClientRect()
      return ir.left >= er.right && Math.abs(ir.top - er.top) < 20
    })(),
    iconRect: icons[0]?.getBoundingClientRect().toJSON() ?? null,
    emailRect: email?.getBoundingClientRect().toJSON() ?? null,
  }
})

console.log('AGODA EMAIL STEP RESULT:', JSON.stringify(state, null, 2))
const pass = state.passwordFields === 0 && state.iconsFound === 1 && state.iconVisible && state.iconNearEmail
console.log(pass ? 'PASS: Kunci icon sits next to email box on password-free Agoda step' : 'FAIL: icon did not appear')

await ctx.close()
server.close()
process.exit(pass ? 0 : 1)
