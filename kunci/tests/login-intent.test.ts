import { describe, expect, it } from 'vitest'
import {
  classifyCredentialForm,
  isConfidentUsernameField,
  isOtpField,
  isUsernameField,
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

  it('does not treat a settings API-key modal as login', () => {
    // Tiruan modal "Add OpenAI Compatible": satu field password (API key),
    // tombol Check/Create/Cancel, URL bukan login. Ikon Kunci wajib diam.
    const modal = (apiKeyType: string) =>
      form({
        pageUrl: 'https://example.com/settings/integrations',
        buttons: ['Check', 'Create', 'Cancel'],
        fields: [
          field({ name: 'name', type: 'text', placeholder: 'OpenAI Compatible (Prod)' }),
          field({ name: 'prefix', type: 'text' }),
          field({ name: 'baseUrl', type: 'text' }),
          field({ name: 'apiKey', type: apiKeyType, autocomplete: '' }),
          field({ name: 'model', type: 'text', placeholder: 'e.g. gpt-4, claude-3-opus' }),
        ],
      })
    for (const t of ['password', 'text']) {
      const result = classifyCredentialForm(modal(t))
      expect(result.kind, `apiKey type=${t}`).toBe('other')
      expect(shouldAutofillKind(result.kind), `autofill type=${t}`).toBe(false)
      expect(shouldOfferSaveKind(result.kind), `save type=${t}`).toBe(false)
    }
  })

  it('treats a one-time code step as otp, never as login', () => {
    const steps: Array<[string, FormSnapshot['fields'][number]]> = [
      ['one-time-code autocomplete', field({ name: 'code', inputMode: 'numeric', autocomplete: 'one-time-code' })],
      ['otp name', field({ name: 'otp', inputMode: 'numeric' })],
      ['verification code label', field({ name: 'x', ariaLabel: 'Verification code' })],
      ['totp', field({ name: 'totpCode', inputMode: 'numeric' })],
    ]
    for (const [label, f] of steps) {
      const result = classifyCredentialForm(
        form({ pageUrl: 'https://example.com/verify', buttons: ['Continue'], fields: [f] }),
      )
      expect(result.kind, label).toBe('otp')
      expect(shouldAutofillKind(result.kind), label).toBe(false)
      expect(shouldOfferSaveKind(result.kind), label).toBe(false)
    }
  })

  it('does not let an OTP box pass as a username', () => {
    const otp = field({ name: 'code', inputMode: 'numeric', autocomplete: 'one-time-code' })
    expect(isOtpField(otp)).toBe(true)
    expect(isUsernameField(otp)).toBe(false)
    expect(isConfidentUsernameField(otp)).toBe(false)
  })

  it('keeps phone and PIN boxes usable as usernames', () => {
    // Regression: keying OTP on inputmode="numeric" alone swallowed these.
    const phone = field({ name: 'phone', type: 'tel', inputMode: 'numeric', autocomplete: 'username' })
    const pin = field({ name: 'pin', inputMode: 'numeric' })
    expect(isOtpField(phone)).toBe(false)
    expect(isOtpField(pin)).toBe(false)
    expect(isConfidentUsernameField(phone)).toBe(true)
  })
})
