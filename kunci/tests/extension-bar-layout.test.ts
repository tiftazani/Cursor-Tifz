import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const content = readFileSync(join(__dirname, '..', 'extension', 'content.js'), 'utf8')

/**
 * The floating bar the extension shows on the page it is filling.
 *
 * Reported from a real screenshot: on a site with several saved accounts the heading was
 * unreadable and the buttons hung outside the card. Measured in a browser at the time,
 * with three account labels (which are email addresses, so long by nature):
 *
 *   .copy width 0px   (title wrapped to one letter per line, 55px tall)
 *   bar 446px inside a host capped at 420px   (content-box: padding added on top)
 *   last button 151px outside the card's right edge
 *
 * Three causes stacked, so these assertions pin all three. The numbers below are the
 * measured before/after, not preferences.
 */

/** Pull one rule's declarations out of the bar's stylesheet string. */
function barRule(selector: string): string {
  const start = content.indexOf('function barStyles()')
  expect(start).toBeGreaterThan(-1)
  const css = content.slice(start, content.indexOf('`\n}', start))
  const i = css.indexOf(`${selector} {`)
  expect(i, `rule not found: ${selector}`).toBeGreaterThan(-1)
  return css.slice(i, css.indexOf('}', i))
}

describe('the extension bar survives several long account labels', () => {
  it('gives the title a floor, so a row of labels cannot crush it to zero', () => {
    // The actual bug. `.copy` was `flex: 1; min-width: 0` — the only item allowed to
    // shrink to nothing — so the labels took the whole row and the heading rendered one
    // letter per line. A floor keeps the title readable and pushes the buttons to a
    // second row instead.
    const copy = barRule('.copy')
    expect(copy).toMatch(/flex:\s*1 1 auto/)
    expect(copy).not.toMatch(/min-width:\s*0[;}\s]/)
    const floor = copy.match(/min-width:\s*min\((\d+)px/)
    expect(floor).not.toBeNull()
    // Wide enough for a readable heading, narrow enough to leave room for a button.
    expect(Number(floor![1])).toBeGreaterThanOrEqual(140)
    expect(Number(floor![1])).toBeLessThanOrEqual(220)
  })

  it('lets the action row wrap under the title', () => {
    // Without wrapping the buttons cannot go anywhere, so they overflow the card.
    expect(barRule('.bar')).toMatch(/flex-wrap:\s*wrap/)
  })

  it('counts padding inside the card width', () => {
    // `content-box` made the card 446px wide inside a host capped at 420px, so even the
    // card's own edge sat outside its box.
    const bar = barRule('.bar')
    expect(bar).toMatch(/box-sizing:\s*border-box/)
    expect(bar).toMatch(/width:\s*100%/)
  })

  it('lets a label be as long as an email address without escaping the card', () => {
    // A label here is an account name, which is normally an email. It has to be able to
    // shrink and break rather than push the card wider than the viewport.
    const button = barRule('button')
    expect(button).toMatch(/overflow-wrap:\s*anywhere/)
    expect(button).toMatch(/max-width:\s*100%/)
    expect(button).toMatch(/min-width:\s*0/)
    // A hard height clips a wrapped label to one line and hides the rest.
    expect(button).not.toMatch(/[^-]height:\s*32px/)
    expect(button).toMatch(/min-height:\s*32px/)
  })

  it('pins the host to a definite width instead of only a maximum', () => {
    // A max-width alone let the inner content decide the width, which is how the card
    // grew past its own cap.
    const host = content.match(/host\.style\.cssText = '([^']+)'/)
    expect(host).not.toBeNull()
    expect(host![1]).toMatch(/width:\s*min\(420px/)
    expect(host![1]).not.toMatch(/max-width:/)
  })

  it('keeps the icon from being squeezed by the copy beside it', () => {
    expect(barRule('.mark')).toMatch(/flex:\s*none/)
  })
})
