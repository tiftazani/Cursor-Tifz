import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const content = read('extension/content.js')
const background = read('extension/background.js')
const manifest = JSON.parse(read('extension/manifest.json')) as {
  content_scripts: { matches: string[]; all_frames?: boolean }[]
}

/**
 * Reported from a real screenshot: on agoda's sign-in page the Kunci bar never
 * appeared, and the user asked for the saved usernames to be listed vertically and
 * scrollable instead of side by side.
 *
 * Measured on the live page with a real browser, not guessed:
 *
 *   agoda.com/account/signin.html holds ZERO visible inputs and NO <form>. The email
 *   box lives in an iframe: https://www.agoda.com/en-us/ul/login/signin?appId=dictator
 *   — one <form>, one input type="email" with autocomplete="username webauthn", one
 *   "Continue" button. The iframe carries sandbox="allow-forms allow-same-origin
 *   allow-scripts ..." and is 500x661 at (470,100).
 *
 * The manifest injected the content scripts with no `all_frames`, so nothing ever ran
 * inside that frame and the page looked like it had no login form at all.
 *
 * The classifier was already right about that form: `/ul/login/signin` matches
 * LOGIN_PATH, the box is `type="email"` (a confident username field), there is no
 * password box, and the only button reads "Continue" — so isUsernameOnlyLoginStep is
 * true and the icon belongs on that email box. The scripts simply were not there.
 */

describe('a login form inside an iframe', () => {
  it('gets the content scripts, because the manifest injects into every frame', () => {
    // Without this, a site that renders its login form in an iframe (agoda, and any
    // embedded SSO or hosted sign-in page) is invisible to Kunci: no icon, no bar, no
    // autofill, and no save offer either.
    expect(manifest.content_scripts).toHaveLength(1)
    expect(manifest.content_scripts[0].all_frames).toBe(true)
    // Still every site, not a list that would have to grow for each new one.
    expect(manifest.content_scripts[0].matches).toEqual(['<all_urls>'])
  })

  it('is reached by the re-injection pass too, frame by frame', () => {
    // The manifest covers a fresh load. The reload path injects by hand, and it used to
    // ask the whole tab one question. With frames that answer is per frame, and
    // injecting a second copy into a frame that already has the scripts is the
    // duplicate-declaration SyntaxError this file already guards against.
    const start = background.indexOf('async function injectContentScripts()')
    expect(start).toBeGreaterThan(-1)
    const body = background.slice(start, background.indexOf('\n/**', start))
    expect(body).toContain('allFrames: true')
    // Only the frames that reported themselves bare may be injected.
    expect(body).toMatch(/r\?\.result === false/)
    expect(body).toContain('frameIds: bare')
  })

  it('does not let a frame that is not the page throw the save away', () => {
    // A pending save is keyed by TAB, so every frame reads the same entry. A frame
    // whose host does not match would call DISMISS_SAVE and clear the save the top
    // frame was about to offer, and the bar would render once per frame.
    const start = content.indexOf('async function restorePendingSave()')
    expect(start).toBeGreaterThan(-1)
    const body = content.slice(start, content.indexOf('\nfunction hookNavigation', start))
    // Exactly one frame acts, and the decision is made before the retry loop that would
    // otherwise put a bar on screen.
    expect(body).toContain('if (window === window.top) {')
    expect(body).toContain('} else if (topHostClaims(submittedPeek) || hostOf(submittedPeek) !== ownHost) {')
    expect(body.indexOf('if (!pendingBelongsHere(submittedPeek))')).toBeLessThan(
      body.indexOf('for (let i = 0; i < 6'),
    )
    // A page nobody on it can claim gets dismissed, instead of surfacing later on an
    // unrelated page in the same tab.
    expect(body).toContain("if (!pendingBelongsHere(submittedPeek)) {\n      void send({ type: 'DISMISS_SAVE' })")
  })

  it('still lets the frame that owns the form act, when the top frame cannot', () => {
    // The case the guard must NOT block: a login form in a cross-origin iframe. The top
    // frame cannot read it, so that frame is the only one that can offer the save.
    expect(content).toContain('function topHostClaims(submitted)')
    const start = content.indexOf('function topHostClaims(submitted)')
    const body = content.slice(start, content.indexOf('\nasync function restorePendingSave', start))
    // A cross-origin top frame throws on `location`, and that must read as "not mine".
    expect(body).toContain('catch {')
    expect(body).toContain('return false')
  })

  it('judges the save against the frames on the page, not only the top host', () => {
    // A site can keep its login form on another host (a sign-in service), and that
    // host is readable from the top document even when the frame is cross-origin.
    expect(content).toContain('function pageHosts()')
    expect(content).toContain("querySelectorAll('iframe[src]')")
    expect(content).toContain('function pendingBelongsHere(submitted)')
  })
})

/** Pull one rule's declarations out of the bar's stylesheet string. */
function barRule(selector: string): string {
  const start = content.indexOf('function barStyles()')
  expect(start).toBeGreaterThan(-1)
  const css = content.slice(start, content.indexOf('`\n}', start))
  const i = css.indexOf(`${selector} {`)
  expect(i, `rule not found: ${selector}`).toBeGreaterThan(-1)
  return css.slice(i, css.indexOf('}', i))
}

describe('the account list in the bar', () => {
  it('lists one account per row instead of side by side', () => {
    // The buttons used to be a row of `flex: 0 1 auto` items, so the labels sat next to
    // each other. An account label is an email address, so they could not be told
    // apart, and `slice(0, 3)` quietly dropped every match past the third.
    const list = barRule('.accounts')
    expect(list).toMatch(/flex:\s*1 1 100%/)
    expect(list).toMatch(/display:\s*grid/)
    expect(list).not.toMatch(/display:\s*flex/)
  })

  it('scrolls inside the card when the site has many accounts', () => {
    const list = barRule('.accounts')
    expect(list).toMatch(/overflow-y:\s*auto/)
    expect(list).toMatch(/max-height:\s*\d+px/)
    // A long list must not scroll the page underneath it.
    expect(list).toMatch(/overscroll-behavior:\s*contain/)
  })

  it('names the username on each row, on its own line', () => {
    expect(content).toContain("list.className = 'accounts'")
    expect(content).toContain("who.className = 'who'")
    expect(content).toContain("user.className = 'user'")
    expect(content).toContain('user.textContent = account.username')
    // The username is the only thing that tells two accounts for one site apart, so it
    // gets its own line rather than being joined into one string.
    expect(barRule('.accounts .user')).toMatch(/font-size/)
  })

  it('offers every match, not just the first three', () => {
    const start = content.indexOf('async function maybeAutofill()')
    expect(start).toBeGreaterThan(-1)
    const body = content.slice(start, content.indexOf('\nfunction outcomeFromDom', start))
    expect(body).toContain('accounts: res.matches.map(')
    expect(body).not.toContain('slice(0, 3)')
  })

  it('also offers the list on a step that only asks for the email', () => {
    // Agoda asks for the email first and the password on the next screen. Before this,
    // maybeAutofill returned as soon as there was no password box, so the whole page
    // stayed silent.
    const start = content.indexOf('async function maybeAutofill()')
    const body = content.slice(start, content.indexOf('\nfunction outcomeFromDom', start))
    expect(body).toContain('const userOnly = passwords.length ? null : usernameOnlyField()')
    expect(body).toContain('if (!passwords.length && !userOnly) return')
  })

  it('does not fill a username-only step silently, even with one match', () => {
    // Filling it blind would put an email in the box with nothing saying which account
    // it came from, before the user has even reached the password prompt.
    const start = content.indexOf('async function maybeAutofill()')
    const body = content.slice(start, content.indexOf('\nfunction outcomeFromDom', start))
    expect(body).toContain('if (res.matches.length === 1 && !userOnly) {')
  })
})

describe('the icon menu', () => {
  it('shows the account name and the username on separate lines', () => {
    const start = content.indexOf('function showMenu(anchor, matches)')
    expect(start).toBeGreaterThan(-1)
    const body = content.slice(start, content.indexOf('\nfunction barStyles', start))
    expect(body).toContain("document.createElement('strong')")
    expect(body).toContain("document.createElement('span')")
    expect(body).not.toContain("item.textContent = `${m.name}")
  })

  it('scrolls when the site has many saved accounts', () => {
    // Without a ceiling the menu runs off the bottom of the viewport and the later rows
    // cannot be clicked at all.
    const css = read('extension/content.css')
    const i = css.indexOf('.kunci-menu {')
    expect(i).toBeGreaterThan(-1)
    const rule = css.slice(i, css.indexOf('}', i))
    expect(rule).toMatch(/max-height:\s*\d+px/)
    expect(rule).toMatch(/overflow-y:\s*auto/)
  })
})
