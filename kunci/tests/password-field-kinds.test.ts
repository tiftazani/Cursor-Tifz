import { describe, expect, it } from 'vitest'
import { isCurrentPasswordField, isNewPasswordField, type FieldSnapshot } from '../src/lib/login-intent'

// extension/login-intent.js is an IIFE that parks its API on globalThis, not a module.
// Importing it for the side effect is the only way to compare the two copies.
// @ts-ignore -- no type declarations for the plain-JS IIFE
await import('../extension/login-intent.js')
type Api = {
  isCurrentPasswordField: (f: FieldSnapshot) => boolean
  isNewPasswordField: (f: FieldSnapshot) => boolean
}
const ext = (globalThis as unknown as { kunciLoginIntent: Api }).kunciLoginIntent

function field(partial: Partial<FieldSnapshot>): FieldSnapshot {
  return {
    tag: 'input',
    type: 'text',
    name: '',
    id: '',
    autocomplete: '',
    placeholder: '',
    ariaLabel: '',
    ...partial,
  }
}

// Every spelling a signup or change-password form uses for its "type it again"
// box. Hyphenated names always worked; the rest silently did not, because
// underscore is a word character to a regex and a capital letter does not break
// \b, so /\bnew\b/ never matched "new_password" or "newPassword".
const newPasswordNames = [
  'new_password',
  'newPassword',
  'new-password',
  'confirmPassword',
  'confirm_password',
  'password_confirmation',
  'retype_password',
  'repeat_password',
  'ulangi_password',
  'konfirmasi_password',
]

const currentPasswordNames = ['password', 'passwd', 'currentPassword', 'current_password', 'pass']

describe('a new-password box is never read as the current password', () => {
  it('recognises every spelling of a new password field', () => {
    for (const name of newPasswordNames) {
      const f = field({ type: 'password', name })
      expect(isNewPasswordField(f), `${name} should be a new-password field`).toBe(true)
      // The dangerous half: reading it as "current" is what let the extension fill
      // the account's existing password into a signup form.
      expect(isCurrentPasswordField(f), `${name} must not be the current password`).toBe(false)
    }
  })

  it('still treats a plain password box as the current password', () => {
    for (const name of currentPasswordNames) {
      const f = field({ type: 'password', name })
      expect(isCurrentPasswordField(f), `${name} should be the current password`).toBe(true)
    }
  })

  it('honours the autocomplete attribute above the field name', () => {
    expect(isNewPasswordField(field({ type: 'password', name: 'password', autocomplete: 'new-password' }))).toBe(true)
    expect(isCurrentPasswordField(field({ type: 'password', name: 'password', autocomplete: 'new-password' }))).toBe(false)
    expect(isCurrentPasswordField(field({ type: 'password', name: 'whatever', autocomplete: 'current-password' }))).toBe(true)
  })

  it('agrees with the extension copy on every spelling', () => {
    // The extension ships its own copy of this logic. Drift here means the two
    // disagree about which box may receive a saved password.
    for (const name of [...newPasswordNames, ...currentPasswordNames]) {
      const f = field({ type: 'password', name })
      expect(ext.isNewPasswordField(f), `new: ${name}`).toBe(isNewPasswordField(f))
      expect(ext.isCurrentPasswordField(f), `current: ${name}`).toBe(isCurrentPasswordField(f))
    }
  })

  it('leaves a non-password field alone', () => {
    expect(isNewPasswordField(field({ type: 'text', name: 'new_password' }))).toBe(false)
    expect(isCurrentPasswordField(field({ type: 'text', name: 'password' }))).toBe(false)
  })
})
