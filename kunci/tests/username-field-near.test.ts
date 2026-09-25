import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'

const source = readFileSync(join(import.meta.dirname, '..', 'extension', 'content.js'), 'utf8')

/**
 * usernameFieldNear lives in content.js, which needs a whole page to import. Pull the
 * function out and run it against plain objects: the bug was pure array logic.
 *
 * `candidates.reverse()` mutates in place, so the `|| candidates[0]` fallback read the
 * array AFTER it had been flipped: it returned the LAST username box in the form, not
 * the first. On a form where the password comes before the username (no candidate
 * precedes it) the extension filled the wrong field.
 */
const body = source.slice(source.indexOf('function usernameFieldNear'), source.indexOf('function kindAround'))
const ctx = vm.createContext({})
vm.runInContext(`${body}\nglobalThis.pick = usernameFieldNear`, ctx)
const pick = (ctx as { pick: (password: unknown) => { id: string } | null }).pick

/** A form whose inputs are the given ids; `isUsernameInput` accepts all but "pass". */
function formOf(ids: string[]) {
  const inputs = ids.map((id) => ({ id }))
  const form = { querySelectorAll: () => inputs }
  vm.runInContext('globalThis.isUsernameInput = (el) => el.id !== "pass"', ctx)
  return { form, inputs }
}

describe('usernameFieldNear picks the nearest username box', () => {
  it('prefers the candidate just above the password', () => {
    const { form, inputs } = formOf(['email', 'pass', 'u1', 'u2'])
    const password = Object.assign(inputs[1], { form })
    expect(pick(password)?.id).toBe('email')
  })

  it('falls back to the FIRST username box, not the last', () => {
    const { form, inputs } = formOf(['pass', 'u1', 'u2'])
    const password = Object.assign(inputs[0], { form })
    expect(pick(password)?.id).toBe('u1')
  })

  it('returns null when the form has no username box', () => {
    const { form, inputs } = formOf(['pass'])
    const password = Object.assign(inputs[0], { form })
    expect(pick(password)).toBeNull()
  })

  // Finding B6: with no <form>, the scope was the WHOLE document, so any anonymous
  // text box counted as a username candidate and the username landed in a newsletter
  // email field or a promo-code box. Verified on /spa: #newsletter_email got the
  // user's email while the login password sat below it.
  it('with no form, never reaches outside the password box own container', () => {
    type FakeEl = {
      id: string
      parentElement?: FakeEl | null
      querySelectorAll?: () => FakeEl[]
      form?: null
    }
    const username: FakeEl = { id: 'username' }
    const password: FakeEl = { id: 'password', form: null }
    const newsletter: FakeEl = { id: 'newsletter_email' }
    const loginBox: FakeEl = { id: 'loginbox', querySelectorAll: () => [username, password] }
    const outside: FakeEl = { id: 'outside', querySelectorAll: () => [newsletter, username, password] }
    password.parentElement = loginBox
    loginBox.parentElement = outside
    outside.parentElement = { id: 'body' }
    const all = [newsletter, username, password]
    vm.runInContext('globalThis.isUsernameInput = () => true', ctx)
    ctx.document = { querySelectorAll: () => all, body: { id: 'body' } }
    // The nearest container holding both boxes is the login box, so #username wins and
    // the newsletter field one level up is never reached.
    expect(pick(password)?.id).toBe('username')
  })
})
