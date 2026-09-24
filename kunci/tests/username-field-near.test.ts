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
})
