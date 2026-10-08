import { describe, expect, it } from 'vitest'
import {
  classifyCredentialForm,
  shouldAutofillKind,
  shouldOfferSaveKind,
  type FormSnapshot,
} from '../src/lib/login-intent'

// extension/login-intent.js is an IIFE that parks its API on globalThis, not a module.
// Importing it for the side effect is the only way to compare the two copies.
// @ts-ignore -- no type declarations for the plain-JS IIFE
await import('../extension/login-intent.js')
type ExtApi = {
  classifyCredentialForm: (form: FormSnapshot) => { kind: string }
}
const ext = (globalThis as unknown as { kunciLoginIntent: ExtApi }).kunciLoginIntent

function field(partial: Partial<FormSnapshot['fields'][number]>): FormSnapshot['fields'][number] {
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

// DOM asli https://ess.pelindo.co.id/fiori (SAP): satu form LOGIN_FORM berisi
// kotak login DAN tombol "Change Password" yang membuka dialog ganti password.
function sapEssForm(passwords: Array<Partial<FormSnapshot['fields'][number]>>): FormSnapshot {
  return {
    id: 'LOGIN_FORM',
    name: 'loginForm',
    action: 'https://ess.pelindo.co.id/fiori',
    method: 'post',
    pageUrl: 'https://ess.pelindo.co.id/fiori',
    buttons: ['Log On', 'Change Password', 'Log On', 'Change Password'],
    fields: [
      field({ type: 'text', name: 'sap-user', id: 'USERNAME_FIELD-inner', placeholder: 'User' }),
      ...passwords.map((p) => field({ type: 'password', ...p })),
      field({ type: 'text', name: 'sap-client', id: 'CLIENT_FIELD-inner', placeholder: 'Client' }),
    ],
  }
}

describe('SAP shared login/change-password buttons', () => {
  it('treats the ESS login form as login even though it shares a Change Password button', () => {
    const form = sapEssForm([{ name: 'sap-password', id: 'PASSWORD_FIELD-inner', placeholder: 'Password' }])
    const kind = classifyCredentialForm(form).kind
    expect(kind).toBe('login')
    expect(shouldAutofillKind(kind)).toBe(true)
    expect(shouldOfferSaveKind(kind)).toBe(true)
    // Cerminan di extension/ wajib setuju: itu yang jalan di browser.
    expect(ext.classifyCredentialForm(form).kind).toBe('login')
  })

  it('keeps a real change-password dialog as change-password', () => {
    const form = sapEssForm([
      { name: 'old', autocomplete: 'current-password' },
      { name: 'new', autocomplete: 'new-password' },
      { name: 'confirm', autocomplete: 'new-password' },
    ])
    const kind = classifyCredentialForm(form).kind
    expect(kind).toBe('change-password')
    expect(shouldAutofillKind(kind)).toBe(false)
    expect(ext.classifyCredentialForm(form).kind).toBe('change-password')
  })
})
