import { describe, expect, it } from 'vitest'
import { isNetlifyAccessGate, NETLIFY_PRIVATE_SITE_HELP } from '../src/lib/netlify-gate'

describe('Netlify private-project gate', () => {
  it('detects the edge-access login redirect HTML', () => {
    const html = `<!DOCTYPE html><html><head><title>Login Redirect</title></head><body>
      <script>var url = new URL('https://app.netlify.com/edge-access?domain=kunci-tifta.netlify.app');</script>
    </body></html>`
    expect(isNetlifyAccessGate(401, html)).toBe(true)
    expect(NETLIFY_PRIVATE_SITE_HELP).toMatch(/Project visibility/)
  })

  it('ignores a normal JSON 401 from Kunci', () => {
    expect(isNetlifyAccessGate(401, '{"ok":false}')).toBe(false)
    expect(isNetlifyAccessGate(200, '<!DOCTYPE html>login redirect edge-access')).toBe(false)
  })
})
