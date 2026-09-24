// Live proof: API-key modal (OpenAI Compatible style) must show NO Kunci icon,
// while a normal login form on the same origin MUST show exactly one icon.
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const EXT = '/Users/tiftazani/Documents/Hermes-AI/Kunci/kunci/extension'

const modal = `<!doctype html><html><body>
<div class="modal"><h2>Add OpenAI Compatible</h2>
<form id="provider" action="/settings/integrations">
  <label>Name<input type="text" name="name" placeholder="OpenAI Compatible (Prod)"></label>
  <label>Prefix<input type="text" name="prefix" value="oc-prod"></label>
  <label>Base URL<input type="text" name="baseUrl" value="https://api.openai.com/v1"></label>
  <label>API Key (for Check)<input type="password" name="apiKey" value=""></label>
  <label>Model ID (optional)<input type="text" name="model" placeholder="e.g. gpt-4, claude-3-opus"></label>
  <button type="button">Check</button><button type="button">Create</button><button type="button">Cancel</button>
</form></div></body></html>`

const login = `<!doctype html><html><body>
<form id="login" action="/login">
  <input type="email" name="email" autocomplete="username">
  <input type="password" name="password" autocomplete="current-password">
  <button type="submit">Sign in</button>
</form></body></html>`

const server = createServer((req, res) => {
  res.setHeader('content-type', 'text/html')
  res.end(req.url.startsWith('/login') ? login : modal)
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const port = server.address().port

const userDataDir = mkdtempSync(join(tmpdir(), 'kunci-modal-'))
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

const modalIcons = await iconsOn('/settings/integrations')
const loginIcons = await iconsOn('/login')
console.log(JSON.stringify({ modalIcons, loginIcons }))
const pass = modalIcons === 0 && loginIcons === 1
console.log(pass ? 'PASS: modal diam, login muncul' : 'FAIL')

await ctx.close()
server.close()
process.exit(pass ? 0 : 1)
