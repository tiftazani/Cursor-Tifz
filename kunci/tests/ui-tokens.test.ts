import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const css = readFileSync(join(__dirname, '..', 'src', 'index.css'), 'utf8')

/** Pull the declarations of a rule, given its exact selector line. */
function rule(selector: string): string {
  const i = css.indexOf(`${selector} {`)
  if (i === -1) throw new Error(`rule not found: ${selector}`)
  return css.slice(i, css.indexOf('}', i))
}

function lightThemeVars(): Record<string, string> {
  const block = rule(":root[data-theme='light']")
  const out: Record<string, string> = {}
  for (const line of block.split('\n')) {
    const m = line.match(/^\s*(--[\w-]+):\s*(.+?);/)
    if (m) out[m[1]] = m[2]
  }
  return out
}

function rootVars(): Record<string, string> {
  const start = css.indexOf(':root {')
  const block = css.slice(start, css.indexOf('}', start))
  const out: Record<string, string> = {}
  for (const line of block.split('\n')) {
    const m = line.match(/^\s*(--[\w-]+):\s*(.+?);/)
    if (m) out[m[1]] = m[2]
  }
  return out
}

describe('layout regression guards', () => {
  it('pins the chip row and toolbar so a long entry list cannot squash them', () => {
    // Without flex:none, overflow:auto zeroes the automatic min-height and
    // .entry-list (flex 1) squeezes the 40px chip band until chips are clipped.
    expect(rule('.filter-row')).toMatch(/flex:\s*none/)
    expect(rule('.list-toolbar')).toMatch(/flex:\s*none/)
  })

  it('keeps the search placeholder short enough for a 300px list column', () => {
    const shell = readFileSync(join(__dirname, '..', 'src', 'views', 'AppShell.tsx'), 'utf8')
    const m = shell.match(/placeholder="([^"]+)"/)
    expect(m).not.toBeNull()
    // Measured: the input has ~134px of text room; this placeholder is 124px.
    expect(m![1].length).toBeLessThanOrEqual(18)
  })

  it('stacks the history username above its date instead of running them together', () => {
    // As bare inline elements they rendered as "tifta9 Sep 2026, 09.03".
    const pane = readFileSync(join(__dirname, '..', 'src', 'views', 'EntryPane.tsx'), 'utf8')
    const who = pane.match(/className="history-who"[\s\S]{0,200}?<\/div>/)
    expect(who, 'EntryPane must wrap the history username and date in .history-who').not.toBeNull()
    expect(who![0]).toMatch(/<strong>[\s\S]*<\/strong>\s*<span/)
    expect(rule('.history-who')).toMatch(/flex-direction:\s*column/)
  })
})

describe('theme contrast tokens', () => {
  const NEEDED = ['--accent', '--accent-2', '--danger', '--warn', '--ok', '--on-warn'] as const

  it('defines every colour token in both themes', () => {
    const root = rootVars()
    const light = lightThemeVars()
    for (const name of NEEDED) {
      expect(root[name], `${name} missing from :root`).toBeTruthy()
      // A token only in :root means the dark value leaks onto white surfaces.
      expect(light[name], `${name} missing from the light theme block`).toBeTruthy()
    }
  })

  const lin = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const lum = (hex: string) => {
    const h = hex.replace('#', '')
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  }
  const ratio = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)]
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
  }

  it('keeps light-theme text tokens at WCAG AA on the light surfaces', () => {
    const light = lightThemeVars()
    const surfaces = { '--bg': light['--bg'], '--bg-2': light['--bg-2'], '--bg-3': light['--bg-3'] }
    for (const name of ['--accent-2', '--danger', '--warn', '--ok'] as const) {
      for (const [surfaceName, surface] of Object.entries(surfaces)) {
        const r = ratio(light[name], surface)
        expect(r, `${name} on ${surfaceName} = ${r.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('keeps white button labels legible on the light accent fill', () => {
    const light = lightThemeVars()
    const r = ratio(light['--accent-text'], light['--accent'])
    expect(r, `accent-text on accent = ${r.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps the nav badge label legible on the warn fill', () => {
    for (const vars of [rootVars(), lightThemeVars()]) {
      const r = ratio(vars['--on-warn'], vars['--warn'])
      expect(r, `on-warn ${vars['--on-warn']} on warn ${vars['--warn']} = ${r.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
    }
  })
})
