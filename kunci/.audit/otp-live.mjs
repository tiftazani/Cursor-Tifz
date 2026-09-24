// Live proof: Kunci must tell an OTP step from a password login.
// OTP step (one code box + Continue) -> no icon, no suggestion.
// Password login on the same origin -> exactly one icon.
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const EXT = '/Users/tiftazani/Documents/Hermes-AI/Kunci/kunci/extension'

const otp = `<!doctype html><html><body>
<form id="verify" action="/verify">
  <h2>Two-step verification</h2>
  <label>Verification code<input type="text" name="otpCode" inputmode="numeric" autocomplete="one-time-code"></label>
  <button type="submit">Continue</button>
</form></body></html>`

const login = `<!doctype html><html><body>
<form id="login" action="/login">
  <input type="email" name="email" autocomplete="username">
  <input type="password" name="password" autocomplete="current-password">
  <button type="submit">Sign in</button>
</form></body></html>`

const server = createServer((req, res) => {
  res.setHeader('content-type', 'text/html')
  res.end(req.url.startsWith('/verify') ? otp : login)
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const port = server.address().port

const userDataDir = mkdtempSync(join(tmpdir(), 'kunci-otp-'))
const ctx = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--no-first-run'],
})

async function iconsOn(path) {
  const page = await ctx.newPage()
  await page.goto(`http://127.0.0.1:${port}${path}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const n = await page.evaluate(() =>
    [...document.querySelectorAll('.kunci-icon-host, [id^="kunci-icon-"]')]
      .filter((h) => h.style.display !== 'none' && h.getBoundingClientRect().width > 0).length,
  )
  await page.close()
  return n
}

const otpIcons = await iconsOn('/verify')
const loginIcons = await iconsOn('/login')
console.log(JSON.stringify({ otpIcons, loginIcons }))
const pass = otpIcons === 0 && loginIcons === 1
console.log(pass ? 'PASS: OTP dibedakan dari password' : 'FAIL')

await ctx.close()
server.close()
process.exit(pass ? 0 : 1)
