export type CredentialKind =
  | 'login'
  | 'signup'
  | 'change-password'
  | 'reset'
  | 'search'
  | 'payment'
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
const LOGIN_PATH = /\/(login|signin|sign-in|masuk|session|auth|sso|accounts\/login)(\/|$|\?)/i
const SIGNUP_PATH = /\/(signup|sign-up|register|join|daftar|create-account)(\/|$|\?)/i
const RESET_PATH = /\/(forgot|reset|recover|password\/(new|reset))(\/|$|\?)/i
const CHANGE_PATH = /\/(settings|account|profile).*(password)|\/(change-password|password\/change)/i
const CHECKOUT_PATH = /\/(checkout|payment|pay|billing|cart)(\/|$|\?)/i

function blob(field: FieldSnapshot): string {
  return `${field.type} ${field.name} ${field.id} ${field.autocomplete} ${field.placeholder} ${field.ariaLabel} ${field.inputMode || ''}`.toLowerCase()
}

function ac(field: FieldSnapshot): string {
  return (field.autocomplete || '').toLowerCase().replace(/[\s_]+/g, '-')
}

export function isUsernameField(field: FieldSnapshot): boolean {
  if (field.tag !== 'input') return false
  const type = (field.type || 'text').toLowerCase()
  if (['password', 'hidden', 'checkbox', 'radio', 'submit', 'button', 'file', 'image', 'range', 'color'].includes(type)) {
    return false
  }
  if (type === 'search' || SEARCH_HINT.test(blob(field))) return false
  if (PAY_HINT.test(blob(field)) || ac(field).startsWith('cc-')) return false
  if (/\b(first[-_ ]?name|last[-_ ]?name|given|family|nama depan|nama belakang|address|alamat|company|organization|otp|one-time)\b/.test(blob(field))) {
    return false
  }
  if (type === 'email' || ac(field) === 'username' || ac(field) === 'email') return true
  if (/user|email|login|account|phone|tel|identifier/.test(blob(field))) return true
  return type === 'text' || type === 'tel'
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
  const btn = form.buttons.join(' ')

  if (form.fields.some((f) => (f.type || '').toLowerCase() === 'search' || SEARCH_HINT.test(blob(f))) && passwords.length === 0) {
    return { kind: 'search', reason: 'form pencarian' }
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
