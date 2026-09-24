export type CredentialKind =
  | 'login'
  | 'signup'
  | 'change-password'
  | 'reset'
  | 'search'
  | 'payment'
  | 'otp'
  | 'other'

export interface FieldSnapshot {
  tag: string
  type: string
  name: string
  id: string
  autocomplete: string
  placeholder: string
  ariaLabel: string
  inputMode?: string
}

export interface FormSnapshot {
  id: string
  name: string
  action: string
  method: string
  fields: FieldSnapshot[]
  buttons: string[]
  pageUrl: string
}

const LOGIN_BTN =
  /\b(log[\s-]*in|sign[\s-]*in|masuk|logon|continue|next|submit|masukkan|anmelden|connexion|entrar|sign in)\b/i
const SIGNUP_BTN =
  /\b(sign[\s-]*up|register|daftar|create account|join now|subscribe|get started|buat akun|registr|daftar akun)\b/i
const CHANGE_BTN = /\b(change password|update password|ganti kata sandi|simpan password|save password|set password)\b/i
const RESET_BTN = /\b(reset password|forgot|lupa kata sandi|send (reset|link)|recover)\b/i
const SEARCH_HINT = /\b(search|cari|query|filter|find|q)\b/i
const PAY_HINT = /\b(card|cc-|cvv|cvc|pan|iban|routing|checkout|payment|pay now|bayar)\b/i
// One-time codes are not vault passwords. A code from SMS/email/authenticator is
// single-use and expires, so filling a saved password into it would send the wrong
// string and could burn a login attempt. Keep them out of every password path.
// Boundary on the left only: real fields are named "otpCode"/"totpCode"/"mfa_token",
// where a right-hand \b never matches.
const OTP_HINT =
  /\b(otp|totp|2fa|mfa|authenticator|passcode|one[-_ ]?time|verification code|verify code|sms code|security token|kode[ -]?(otp|verifikasi|sms))/i
const LOGIN_PATH = /\/(login|signin|sign-in|masuk|session|auth|sso|accounts\/login)(\/|$|\?|\.)/i
const SIGNUP_PATH = /\/(signup|sign-up|register|join|daftar|create-account)(\/|$|\?|\.)/i
const RESET_PATH = /\/(forgot|reset|recover|password\/(new|reset))(\/|$|\?)/i
const CHANGE_PATH = /\/(settings|account|profile).*(password)|\/(change-password|password\/change)/i
const CHECKOUT_PATH = /\/(checkout|payment|pay|billing|cart)(\/|$|\?)/i

// Deliberately narrower than LOGIN_BTN: "submit" alone appears on every web form, and
// this gate decides whether Kunci shows up next to an email box on pages with no
// password field at all.
const USERNAME_ONLY_BTN = /\b(continue|next|lanjut|log ?in|sign ?in|logon|masuk|masukkan|anmelden|connexion|entrar)\b/i

function blob(field: FieldSnapshot): string {
  return `${field.type} ${field.name} ${field.id} ${field.autocomplete} ${field.placeholder} ${field.ariaLabel} ${field.inputMode || ''}`.toLowerCase()
}

function ac(field: FieldSnapshot): string {
  return (field.autocomplete || '').toLowerCase().replace(/[\s_]+/g, '-')
}

/**
 * A one-time code box: SMS/email/authenticator. It must never receive a vault
 * password, and an entry is never saved from it.
 *
 * Deliberately NOT keyed on inputmode="numeric" alone: phone-number and PIN fields
 * use that too, and treating them as OTP would hide the username box on every
 * phone-based login. The name/label/autocomplete has to say "code".
 */
export function isOtpField(field: FieldSnapshot): boolean {
  if (field.tag !== 'input') return false
  if (ac(field) === 'one-time-code') return true
  return OTP_HINT.test(blob(field))
}

export function isUsernameField(field: FieldSnapshot): boolean {
  if (field.tag !== 'input') return false
  const type = (field.type || 'text').toLowerCase()
  if (['password', 'hidden', 'checkbox', 'radio', 'submit', 'button', 'file', 'image', 'range', 'color'].includes(type)) {
    return false
  }
  if (type === 'search' || SEARCH_HINT.test(blob(field))) return false
  if (PAY_HINT.test(blob(field)) || ac(field).startsWith('cc-')) return false
  if (isOtpField(field)) return false
  if (/\b(first[-_ ]?name|last[-_ ]?name|given|family|nama depan|nama belakang|address|alamat|company|organization|otp|one-time)\b/.test(blob(field))) {
    return false
  }
  if (type === 'email' || ac(field) === 'username' || ac(field) === 'email') return true
  if (/user|email|login|account|phone|tel|identifier/.test(blob(field))) return true
  return type === 'text' || type === 'tel'
}

/**
 * A username field we are sure about: it says so itself.
 * isUsernameField also accepts any anonymous text box, which is fine for scanning a
 * form but not for typing into it, because on a password-only page that box is a
 * search or promo-code field.
 */
export function isConfidentUsernameField(field: FieldSnapshot): boolean {
  if (field.tag !== 'input') return false
  if (!isUsernameField(field)) return false
  const auto = ac(field)
  if (type_(field) === 'email' || auto === 'username' || auto === 'email') return true
  return /user|email|login|account|identifier/.test(blob(field))
}

function type_(field: FieldSnapshot): string {
  return (field.type || 'text').toLowerCase()
}

export type CredentialShape = 'user-pass' | 'pass-only'

/**
 * What this page is actually asking for. A password-only page must not receive a
 * username; the caller uses this so the username never lands in a nearby text box.
 */
export function credentialShape(form: FormSnapshot): CredentialShape {
  const hasPassword = form.fields.some((f) => type_(f) === 'password')
  if (!hasPassword) return 'user-pass'
  return form.fields.some(isConfidentUsernameField) ? 'user-pass' : 'pass-only'
}

/**
 * Sites like Agoda ask for the email first and only reveal the password box after
 * Continue. Nothing is offered on that first step today, so the vault looks absent
 * exactly when the user expects it. This is the narrow case where Kunci may appear
 * next to a username box before any password field exists.
 */
export function isUsernameOnlyLoginStep(form: FormSnapshot): boolean {
  if (form.fields.some((f) => type_(f) === 'password')) return false
  if (!form.fields.some(isConfidentUsernameField)) return false
  const hay = `${form.id} ${form.name} ${form.action} ${form.buttons.join(' ')}`.toLowerCase()
  const url = `${form.pageUrl} ${form.action}`
  if (SIGNUP_PATH.test(url) || SIGNUP_BTN.test(form.buttons.join(' ')) || /\bsignup|register|daftar\b/.test(hay)) return false
  if (RESET_PATH.test(url) || RESET_BTN.test(form.buttons.join(' ')) || /forgot|reset-password/.test(hay)) return false
  return LOGIN_PATH.test(url) || USERNAME_ONLY_BTN.test(form.buttons.join(' '))
}

export function isCurrentPasswordField(field: FieldSnapshot): boolean {
  if ((field.type || '').toLowerCase() !== 'password') return false
  const auto = ac(field)
  if (auto === 'new-password') return false
  if (auto === 'current-password') return true
  const text = blob(field)
  if (/\b(new|baru|confirm|konfirmasi|ulang|repeat)\b/.test(text)) return false
  return true
}

export function isNewPasswordField(field: FieldSnapshot): boolean {
  if ((field.type || '').toLowerCase() !== 'password') return false
  const auto = ac(field)
  if (auto === 'new-password') return true
  return /\b(new|baru|confirm|konfirmasi|ulang|repeat|create)\b/.test(blob(field))
}

export function classifyCredentialForm(form: FormSnapshot): { kind: CredentialKind; reason: string } {
  const hay = `${form.id} ${form.name} ${form.action} ${form.buttons.join(' ')}`.toLowerCase()
  const url = `${form.pageUrl} ${form.action}`
  const passwords = form.fields.filter((f) => (f.type || '').toLowerCase() === 'password')
  const current = passwords.filter(isCurrentPasswordField)
  const created = passwords.filter(isNewPasswordField)
  const users = form.fields.filter(isUsernameField)
  const confidentUsers = form.fields.filter(isConfidentUsernameField)
  const btn = form.buttons.join(' ')

  if (form.fields.some((f) => (f.type || '').toLowerCase() === 'search' || SEARCH_HINT.test(blob(f))) && passwords.length === 0) {
    return { kind: 'search', reason: 'form pencarian' }
  }
  // A one-time code box is not a vault password. Checked before everything else
  // because an OTP step can otherwise look exactly like a login: one text box and
  // a Continue button.
  if (form.fields.some(isOtpField)) {
    return { kind: 'otp', reason: 'kotak kode sekali pakai (OTP), bukan password' }
  }
  if (form.fields.some((f) => PAY_HINT.test(blob(f)) || ac(f).startsWith('cc-')) || CHECKOUT_PATH.test(url) || PAY_HINT.test(hay)) {
    return { kind: 'payment', reason: 'field pembayaran, bukan login' }
  }
  if (RESET_PATH.test(url) || RESET_BTN.test(btn) || /forgot|reset-password/.test(hay)) {
    return { kind: 'reset', reason: 'reset / lupa password' }
  }
  if (passwords.length >= 2 && (created.length >= 1 || CHANGE_BTN.test(btn) || CHANGE_PATH.test(url))) {
    if (current.length >= 1 && created.length >= 1) {
      return { kind: 'change-password', reason: 'ganti password (current + new)' }
    }
    return { kind: 'signup', reason: 'lebih dari satu field password' }
  }
  if (created.length >= 1 && current.length === 0) {
    return { kind: 'signup', reason: 'autocomplete new-password' }
  }
  if (SIGNUP_PATH.test(url) || SIGNUP_BTN.test(btn) || /\bsignup|register|daftar\b/.test(hay)) {
    return { kind: 'signup', reason: 'tombol atau URL pendaftaran' }
  }
  if (CHANGE_PATH.test(url) || CHANGE_BTN.test(btn)) {
    return { kind: 'change-password', reason: 'pengaturan ganti password' }
  }
  if (passwords.length === 0) {
    return { kind: 'other', reason: 'tidak ada field password' }
  }
  if (LOGIN_PATH.test(url) || LOGIN_BTN.test(btn) || /\blogin|signin|masuk\b/.test(hay)) {
    return { kind: 'login', reason: 'form masuk sistem' }
  }
  // A lone secret box on a settings page (API key, token, webhook secret) is not
  // a login, even when it has type="password" and sits next to username-looking
  // boxes like Name or Base URL. Real password managers treat these as secrets,
  // not credentials: they stay out of the way instead of pushing a suggestion.
  if (passwords.length === 1 && confidentUsers.length === 0 && !LOGIN_PATH.test(url) && !LOGIN_BTN.test(btn)) {
    return { kind: 'other', reason: 'satu field rahasia di halaman non-login' }
  }
  if (current.length >= 1 || users.length >= 1) {
    return { kind: 'login', reason: 'username/password untuk autentikasi' }
  }
  return { kind: 'other', reason: 'field password bukan untuk masuk sistem' }
}

export function shouldAutofillKind(kind: CredentialKind): boolean {
  return kind === 'login'
}

export function shouldOfferSaveKind(kind: CredentialKind): boolean {
  return kind === 'login' || kind === 'change-password'
}

export function snapshotFromElements(
  fields: FieldSnapshot[],
  buttons: string[],
  meta: { id?: string; name?: string; action?: string; method?: string; pageUrl: string },
): FormSnapshot {
  return {
    id: meta.id || '',
    name: meta.name || '',
    action: meta.action || '',
    method: meta.method || '',
    fields,
    buttons,
    pageUrl: meta.pageUrl,
  }
}
