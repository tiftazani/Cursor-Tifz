import { describe, expect, it } from 'vitest'
import { tenantField, type TenantField } from '../src/lib/match'

/**
 * Two password boxes in one form is the shape of a shared-password site: a password
 * every member uses, then a personal one. The company box is what tells the saved
 * logins apart.
 *
 * The names matter as much as the labels. A real site writes "company_code" and
 * "shared_password" with underscores, and "_" counts as a word character, so a plain
 * word-boundary test sees neither. These cases use the real spelling.
 */
function field(over: Partial<TenantField> = {}): TenantField {
  return { tag: 'input', type: 'text', name: '', id: '', autocomplete: '', placeholder: '', ariaLabel: '', label: '', ...over }
}

const companyBox = field({ name: 'company_code' })
const sharedPassword = field({ type: 'password', name: 'shared_password' })
const personalPassword = field({ type: 'password', name: 'password', autocomplete: 'current-password' })
const secondPassword = field({ type: 'password', name: 'password_again' })

describe('tenantField', () => {
  it('reads the company box of a two-stage form by its real field name', () => {
    expect(tenantField({ fields: [companyBox, sharedPassword, secondPassword] })?.name).toBe('company_code')
  })

  it('reads the company box when the name is a two-word run', () => {
    // "kode" and "perusahaan" are two words in the name, so the pair has to be read
    // as a phrase, not as one token.
    const named = field({ name: 'kode_perusahaan' })
    expect(tenantField({ fields: [named, sharedPassword, secondPassword] })?.name).toBe('kode_perusahaan')
  })

  it('reads the company box when only the label carries the word', () => {
    const labelled = field({ name: 'tenant' })
    expect(tenantField({ fields: [labelled, sharedPassword, secondPassword] })?.name).toBe('tenant')
  })

  it('answers null on an ordinary single-password login', () => {
    // A company name beside ONE password box is a label, not a second credential.
    // Reading it as one would put a company warning on ordinary sites.
    expect(tenantField({ fields: [companyBox, personalPassword] })).toBe(null)
    expect(tenantField({ fields: [field({ name: 'full_name', placeholder: 'Nama lengkap' }), personalPassword] })).toBe(null)
  })

  it('ignores a form with two password boxes and no marked company field', () => {
    // A signup form does not become a shared-password site just by having two boxes.
    const signup = field({ name: 'full_name', placeholder: 'Nama lengkap' })
    expect(tenantField({ fields: [signup, field({ type: 'password', name: 'new_password' }), field({ type: 'password', name: 'confirm_password' })] })).toBe(null)
  })

  it('does not read a word that merely contains the hint', () => {
    // "someadmin" is not an admin box, and "sharedpassword" is not a shared password.
    expect(tenantField({ fields: [field({ name: 'someadmin' }), field({ type: 'password', name: 'sharedpassword' }), secondPassword] })).toBe(null)
  })

  it('never reads the username box as the company box', () => {
    const username = field({ name: 'email', autocomplete: 'username' })
    const found = tenantField({ fields: [companyBox, username, sharedPassword, secondPassword] }, username)
    expect(found?.name).toBe('company_code')
  })

  it('never reads an OTP box as the company box', () => {
    const otp = field({ name: 'otp_code', autocomplete: 'one-time-code' })
    expect(tenantField({ fields: [otp, sharedPassword, secondPassword] })).toBe(null)
  })
})
