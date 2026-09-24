import { describe, expect, it } from 'vitest'
import { isUsernameOnlyLoginStep, type FormSnapshot } from '../src/lib/login-intent'

function form(fields: FormSnapshot['fields'], pageUrl = 'https://example.com/', buttons: string[] = []): FormSnapshot {
  return { id: '', name: '', action: '', method: 'post', buttons, pageUrl, fields }
}

function field(partial: FormSnapshot['fields'][number]) {
  return { tag: 'input', type: 'text', name: '', id: '', autocomplete: '', placeholder: '', ariaLabel: '', ...partial }
}

// Agoda asks for the email, then reveals the password only after Continue. On that first
// step Kunci used to show nothing, so the vault looked missing exactly when it was wanted.
describe('username-only login step', () => {
  it('recognises the Agoda-style email step', () => {
    expect(
      isUsernameOnlyLoginStep(
        form([field({ type: 'email', name: 'email', placeholder: 'id@email.com' })], 'https://www.agoda.com/account/signin.html?ottoken=abc', ['Continue']),
      ),
    ).toBe(true)
  })

  it('recognises a classic username step', () => {
    expect(
      isUsernameOnlyLoginStep(form([field({ type: 'email', name: 'email', autocomplete: 'username' })], 'https://mail.example.com/login', ['Next'])),
    ).toBe(true)
  })

  it('stays out of the way once a password box exists', () => {
    expect(
      isUsernameOnlyLoginStep(
        form(
          [
            field({ type: 'email', name: 'email', autocomplete: 'username' }),
            field({ type: 'password', name: 'password', autocomplete: 'current-password' }),
          ],
          'https://www.agoda.com/account/signin.html',
          ['Sign in'],
        ),
      ),
    ).toBe(false)
  })

  it('never fires on signup, reset, or a plain search box', () => {
    expect(
      isUsernameOnlyLoginStep(form([field({ type: 'email', name: 'email' })], 'https://example.com/register', ['Create account'])),
    ).toBe(false)
    expect(
      isUsernameOnlyLoginStep(form([field({ type: 'email', name: 'email' })], 'https://example.com/forgot', ['Send reset link'])),
    ).toBe(false)
    expect(isUsernameOnlyLoginStep(form([field({ type: 'text', name: 'q', placeholder: 'Cari' })], 'https://example.com/', ['Search']))).toBe(false)
    expect(isUsernameOnlyLoginStep(form([field({ type: 'text', name: 'newsletter' })], 'https://example.com/blog', ['Subscribe']))).toBe(false)
  })
})
