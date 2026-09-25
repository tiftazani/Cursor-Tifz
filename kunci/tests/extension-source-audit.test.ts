import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'

const root = join(import.meta.dirname, '..')
const content = readFileSync(join(root, 'extension', 'content.js'), 'utf8')
const background = readFileSync(join(root, 'extension', 'background.js'), 'utf8')

/**
 * Findings B5, B6, B7, B10 from the extension audit (2026-09-25).
 *
 * content.js and background.js need a whole browser to import, so these read the
 * source and run the extracted functions in a vm. Each assertion fails against the
 * code as it was.
 */

/** Pull a top-level function out of a source file by name. */
function extractFrom(source: string, name: string, nextMarker: string): string {
  const start = source.indexOf(`function ${name}(`)
  const end = source.indexOf(nextMarker, start)
  expect(start).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(start)
  return source.slice(start, end)
}

const extract = (name: string, nextMarker: string) => extractFrom(content, name, nextMarker)

describe('B5: a submitted form with no password is not a login', () => {
  it('readFormCreds returns nothing for a form without a password box', () => {
    const body = extract('readFormCreds', 'function captureFromEvent')
    const ctx = vm.createContext({
      // The form under test has an email box and no password box at all.
      intent: { isNewPasswordField: () => false, classifyAround: () => ({ kind: 'other' }) },
      passwordFields: () => [{ value: 'RAHASIA-LOGIN-SAYA', name: 'password' }],
      visibleInput: () => true,
      usernameFieldNear: () => ({ value: 'tif@example.com' }),
      isUsernameInput: () => true,
      kindAround: () => 'login',
      lastUsername: '',
      lastPassword: '',
      lastKind: 'other',
      document: { querySelectorAll: () => [] },
      Element: class {},
      HTMLInputElement: class {},
    })
    vm.runInContext(`${body}\nglobalThis.readFormCreds = readFormCreds`, ctx)
    const form = { querySelectorAll: () => [] }
    const creds = (ctx as { readFormCreds: (f: unknown) => { password: string } }).readFormCreds(form)
    // Before the fix this returned the OTHER form's password and the extension offered
    // to save a login for a newsletter signup.
    expect(creds.password).toBe('')
  })
})

describe('B10: the reload path revives open tabs', () => {
  it('reloads tabs before calling runtime.reload', () => {
    const sync = extractFrom(background, 'syncUnpackedExtension', '\nfunction startExtensionSync')
    const reviveAt = sync.indexOf('reloadContentScriptTabs()')
    const reloadAt = sync.indexOf('chrome.runtime.reload()')
    expect(reviveAt).toBeGreaterThan(-1)
    expect(reloadAt).toBeGreaterThan(reviveAt)
  })

  it('reloadContentScriptTabs exists and reloads every http tab', () => {
    const body = extractFrom(background, 'reloadContentScriptTabs', '\nfunction ack')
    expect(body).toContain("chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] })")
    expect(body).toContain('chrome.tabs.reload')
  })
})

describe('B7: the icon avoids clickable neighbours', () => {
  it('placeOutside passes the nearby clickables to iconPosition', () => {
    const body = extract('placeOutside', 'function repositionIcons')
    expect(body).toContain('clickablesNear(el)')
    expect(body).toContain('avoid:')
  })

  it('clickablesNear only looks at interactive elements', () => {
    const body = extract('clickablesNear', 'function placeOutside')
    expect(body).toContain('button')
    expect(body).toContain('input[type="submit"]')
    // The icon itself must never be treated as an obstacle.
    expect(body).toContain(".closest('.kunci-icon-host')")
  })
})

describe('B6: with no form the username search stays inside the password container', () => {
  it('usernameFieldNear walks up from the password box instead of scanning the page', () => {
    const body = extract('usernameFieldNear', 'function kindAround')
    expect(body).toContain('password.parentElement')
    expect(body).toContain('node !== document.body')
  })
})

describe('B1: fill() only uses classified login fields', () => {
  it('has no passwordFields()[0] fallback', () => {
    const body = extract('fill', 'function isKunciPage')
    expect(body).toContain('loginPasswordFields()[0]')
    // The removed fallback: the first password box on the page whatever it is.
    expect(body).not.toContain('passwordFields().filter')
  })
})
