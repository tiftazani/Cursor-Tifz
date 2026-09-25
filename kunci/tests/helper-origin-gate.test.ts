import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The helper daemon listens on 127.0.0.1:8780 and hands out a token that opens
 * POST /fill. It has no way to tell a page it wrote from a page it did not, except
 * the Origin header, so an unrecognised Origin must be refused before any route runs.
 *
 * Verified live: `curl -H 'Origin: https://evil.example' .../api/local-token` used to
 * return the token. It now returns 403 with no token in the body.
 */
const source = readFileSync(join(import.meta.dirname, '..', 'helper', 'daemon.mjs'), 'utf8')

describe('helper daemon refuses a foreign Origin', () => {
  it('checks the Origin before the router, not just in the CORS headers', () => {
    const gate = source.indexOf('if (origin && !localOrigin(req))')
    expect(gate).toBeGreaterThan(-1)
    // Every route lives inside this try block; the gate has to come first.
    const router = source.indexOf("url.pathname === '/api/local-token'")
    expect(router).toBeGreaterThan(gate)
  })

  it('answers 403 and does not build a body that carries the token', () => {
    const gate = source.indexOf('if (origin && !localOrigin(req))')
    const block = source.slice(gate, gate + 200)
    expect(block).toContain('403')
    expect(block).not.toContain('token')
  })

  it('still lets the real callers through', () => {
    // A missing Origin is curl, the helper itself, or a native app: not a web page.
    expect(source).toContain("if (!origin) return null")
    // The unpacked extension talks to the daemon too. The id must be exactly 32
    // characters: Chrome derives it from the folder path and can never emit 33,
    // which is what shipped and made the extension's own /health poll answer 403.
    expect(source).toContain('chrome-extension://djiblgfjmhjebgacdljbdoibbancniad')
    expect(source).not.toContain('chrome-extension://djiblgfjmjhjebgacdljbdoibbancniad')
  })

  it('does not reflect an arbitrary Origin in the CORS headers', () => {
    // The original bug: `res.setHeader('Access-Control-Allow-Origin', req.headers.origin)`.
    expect(source).not.toMatch(/Access-Control-Allow-Origin['"],\s*req\.headers\.origin/)
  })
})
