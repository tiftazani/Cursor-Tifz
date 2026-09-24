import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The OTP route has one order that works: send the email, then store the code.
 * Storing first left a reusable record behind when the send failed, so the next
 * request answered ok:true and the user waited for a code that never arrived.
 */
describe('worker OTP route', () => {
  const source = readFileSync(join(import.meta.dirname, '..', 'worker', 'index.ts'), 'utf8')

  it('sends the code before storing it', () => {
    const send = source.indexOf("await sendEmail(env, 'Kode masuk Kunci'")
    const store = source.indexOf("await setKey('otp'")
    expect(send).toBeGreaterThan(-1)
    expect(store).toBeGreaterThan(-1)
    expect(send).toBeLessThan(store)
  })

  it('never answers a missing storage key with undefined', () => {
    // Response.json(undefined) produces a body of "undefined", which the client
    // cannot parse, so every read falls back to null.
    expect(source).toContain('?? null')
    expect(source).not.toMatch(/Response\.json\(await this\.state\.storage\.get/)
  })
})
