import { describe, expect, it } from 'vitest'
import { credentialShape, isConfidentUsernameField, type FormSnapshot } from '../src/lib/login-intent'

function form(fields: FormSnapshot['fields'], pageUrl = 'https://example.com/'): FormSnapshot {
  return { id: '', name: '', action: '', method: 'post', buttons: [], pageUrl, fields }
}

function field(partial: FormSnapshot['fields'][number]) {
  return { tag: 'input', type: 'text', name: '', id: '', autocomplete: '', placeholder: '', ariaLabel: '', ...partial }
}

// A password-only page must not receive a username: the nearest text box there is a
// search or promo-code field, and typing a saved username into it leaks the identity.
describe('credential shape', () => {
  it('calls a page with a real username field user-pass', () => {
    expect(
      credentialShape(
        form([
          field({ type: 'email', name: 'email', autocomplete: 'username' }),
          field({ type: 'password', name: 'password', autocomplete: 'current-password' }),
        ]),
      ),
    ).toBe('user-pass')
  })

  it('calls a page whose only text box is anonymous pass-only', () => {
    expect(
      credentialShape(
        form([
          field({ type: 'text', name: 'code', placeholder: 'Kode promo' }),
          field({ type: 'password', name: 'password' }),
        ]),
      ),
    ).toBe('pass-only')
  })

  it('treats a lone password field as pass-only', () => {
    expect(credentialShape(form([field({ type: 'password', name: 'pin' })]))).toBe('pass-only')
  })

  it('only claims a field when the field says so itself', () => {
    expect(isConfidentUsernameField(field({ type: 'text', name: 'q', placeholder: 'Cari' }))).toBe(false)
    expect(isConfidentUsernameField(field({ type: 'text', name: 'username' }))).toBe(true)
    expect(isConfidentUsernameField(field({ type: 'email' }))).toBe(true)
    expect(isConfidentUsernameField(field({ type: 'text', name: 'user_id' }))).toBe(true)
  })
})
