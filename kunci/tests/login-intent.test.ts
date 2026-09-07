import { describe, expect, it } from 'vitest'
import {
  classifyCredentialForm,
  shouldAutofillKind,
  shouldOfferSaveKind,
  type FormSnapshot,
} from '../src/lib/login-intent'

function form(partial: Partial<FormSnapshot> & Pick<FormSnapshot, 'fields'>): FormSnapshot {
  return {
    id: '',
    name: '',
    action: '',
    method: 'post',
    buttons: [],
    pageUrl: 'https://example.com/',
    ...partial,
  }
}

function field(partial: FormSnapshot['fields'][number]) {
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

describe('login intent', () => {
  it('treats username + current-password as system login', () => {
    const result = classifyCredentialForm(
      form({
        pageUrl: 'https://mail.example.com/login',
        buttons: ['Masuk'],
        fields: [
          field({ name: 'email', type: 'email', autocomplete: 'username' }),
          field({ name: 'password', type: 'password', autocomplete: 'current-password' }),
        ],
      }),
    )
    expect(result.kind).toBe('login')
    expect(shouldAutofillKind(result.kind)).toBe(true)
    expect(shouldOfferSaveKind(result.kind)).toBe(true)
  })

  it('does not treat signup as login', () => {
    const result = classifyCredentialForm(
      form({
        pageUrl: 'https://example.com/register',
        buttons: ['Create account'],
        fields: [
          field({ name: 'email', type: 'email' }),
          field({ name: 'password', type: 'password', autocomplete: 'new-password' }),
          field({ name: 'confirm', type: 'password', autocomplete: 'new-password' }),
        ],
      }),
    )
    expect(result.kind).toBe('signup')
    expect(shouldAutofillKind(result.kind)).toBe(false)
    expect(shouldOfferSaveKind(result.kind)).toBe(false)
  })

  it('detects change-password, search, and payment', () => {
    expect(
      classifyCredentialForm(
        form({
          pageUrl: 'https://example.com/settings/password',
          buttons: ['Update password'],
          fields: [
            field({ name: 'current', type: 'password', autocomplete: 'current-password' }),
            field({ name: 'new', type: 'password', autocomplete: 'new-password' }),
          ],
        }),
      ).kind,
    ).toBe('change-password')
    expect(
      classifyCredentialForm(
        form({
          pageUrl: 'https://shop.example.com/search',
          fields: [field({ name: 'q', type: 'search', autocomplete: 'off' })],
        }),
      ).kind,
    ).toBe('search')
    expect(
      classifyCredentialForm(
        form({
          pageUrl: 'https://shop.example.com/checkout',
          buttons: ['Pay now'],
          fields: [field({ name: 'cc-number', autocomplete: 'cc-number' })],
        }),
      ).kind,
    ).toBe('payment')
  })
})
