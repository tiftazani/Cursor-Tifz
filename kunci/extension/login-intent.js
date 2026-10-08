(function (root) {
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

  function blob(field) {
    return `${field.type} ${field.name} ${field.id} ${field.autocomplete} ${field.placeholder} ${field.ariaLabel} ${field.inputMode || ''}`.toLowerCase()
  }

  /** Field text as written, before lowercasing, so camelCase can be split. */
  function rawBlob(field) {
    return `${field.type} ${field.name} ${field.id} ${field.autocomplete} ${field.placeholder} ${field.ariaLabel} ${field.inputMode || ''}`
  }

  /**
   * Field text with word separators restored and lowercased, so \b can match.
   *
   * "new_password", "newPassword" and "confirmPassword" are single "words" to a
   * regex: underscore is a word character and a capital letter does not break \b.
   * Only the hyphenated spelling matched, so a signup form's new-password box read
   * as a CURRENT password box and the account's existing password was offered for
   * it. Split BEFORE lowercasing: "newPassword" is already "newpassword" after.
   *
   * Mirrors words() in src/lib/login-intent.ts.
   */
  function words(text) {
    return text
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_\-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase()
  }

  function ac(field) {
    return (field.autocomplete || '').toLowerCase().replace(/[\s_]+/g, '-')
  }

  function isOtpField(field) {
    if (field.tag !== 'input') return false
    if (ac(field) === 'one-time-code') return true
    // Deliberately NOT keyed on inputmode="numeric" alone: phone-number and PIN
    // fields use that too, and treating them as OTP would hide the username box on
    // every phone-based login.
    return OTP_HINT.test(blob(field))
  }

  /**
   * A site that asks for a shared password on every entry, then a personal username
   * and password. One vault entry cannot carry two passwords, so what the user needs
   * from such a site is a readable label: "which company code is this login for".
   *
   * True only on strong evidence: a password box whose own text says
   * organisation/company/workspace, or a field the page marked
   * autocomplete="organization" that is NOT the username.
   *
   * Mirrors tenantField in src/lib/match.ts.
   */
  // A word boundary is unusable on field names: "_" is a word character, so
  // /\bshared\b/ does NOT match "shared_password", and [ _-] runs like "company_code"
  // are exactly how these boxes are named. Mirrors src/lib/match.ts.
  const EDGE_START = '(^|[^A-Za-z0-9])'
  const EDGE_END = '($|[^A-Za-z0-9])'
  const EDGE_START_G = '([^A-Za-z0-9])'
  const TENANT_FIELD_HINT = new RegExp(
    `${EDGE_START}(organization|organisation|company|tenant|workspace|team[ _-]?(code|id|name)|company[ _-]?(code|id)|kode[ _-]?(perusahaan|organisasi|tenant)|nama[ _-]?(perusahaan|organisasi)|perusahaan|organisasi)${EDGE_END}`,
    'i',
  )
  const TENANT_PASSWORD_HINT = new RegExp(
    `${EDGE_START_G}(shared|company|organisation|organization|tenant|org|group|team|master|parent|admin)${EDGE_END}`,
    'i',
  )

  function fieldText(field) {
    return `${field.name || ''} ${field.id || ''} ${field.autocomplete || ''} ${field.placeholder || ''} ${field.ariaLabel || ''} ${field.label || ''}`
  }

  /**
   * The company box of a two-password form, or null.
   *
   * Two password boxes in one form is not normal, and when it happens the second
   * secret is almost always something else: a PIN, a confirmation box, a new
   * password. A field only counts as the company when its own text says so, and
   * never when that field is the username.
   */
  function tenantField(form, usernameField) {
    const fields = ((form && form.fields) || []).filter((f) => f && f.tag !== 'select')
    const passwordFields = fields.filter((f) => (f.type || '').toLowerCase() === 'password')
    if (passwordFields.length < 2) return null
    const strong = passwordFields.some((f) => TENANT_PASSWORD_HINT.test(fieldText(f)))
    const named = fields.filter(
      (f) =>
        (f.type || 'text').toLowerCase() !== 'password' &&
        !/one-time-code/i.test(f.autocomplete || '') &&
        TENANT_FIELD_HINT.test(fieldText(f)),
    )
    if (!named.length) return null
    // When the password box itself says the password is shared, the company box may be
    // the same element the caller thinks is the username: the real site asks for the
    // company code first, and only then for a personal username.
    if (!strong) return named.find((f) => f !== usernameField) || null
    return named.find((f) => f !== usernameField) || named[0]
  }

  function isUsernameField(field) {
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

  function isConfidentUsernameField(field) {
    if (field.tag !== 'input') return false
    if (!isUsernameField(field)) return false
    const auto = ac(field)
    if ((field.type || 'text').toLowerCase() === 'email' || auto === 'username' || auto === 'email') return true
    return /user|email|login|account|identifier/.test(blob(field))
  }

  function credentialShape(form) {
    const hasPassword = form.fields.some((f) => (f.type || '').toLowerCase() === 'password')
    if (!hasPassword) return 'user-pass'
    return form.fields.some(isConfidentUsernameField) ? 'user-pass' : 'pass-only'
  }

  function isUsernameOnlyLoginStep(form) {
    if (form.fields.some((f) => (f.type || '').toLowerCase() === 'password')) return false
    if (!form.fields.some(isConfidentUsernameField)) return false
    const hay = `${form.id} ${form.name} ${form.action} ${form.buttons.join(' ')}`.toLowerCase()
    const url = `${form.pageUrl} ${form.action}`
    const btn = form.buttons.join(' ')
    if (SIGNUP_PATH.test(url) || SIGNUP_BTN.test(btn) || /\bsignup|register|daftar\b/.test(hay)) return false
    if (RESET_PATH.test(url) || RESET_BTN.test(btn) || /forgot|reset-password/.test(hay)) return false
    return LOGIN_PATH.test(url) || USERNAME_ONLY_BTN.test(btn)
  }

  function isCurrentPasswordField(field) {
    if ((field.type || '').toLowerCase() !== 'password') return false
    const auto = ac(field)
    if (auto === 'new-password') return false
    if (auto === 'current-password') return true
    const text = words(rawBlob(field))
    if (/\b(new|baru|confirm|confirmation|konfirmasi|ulang|ulangi|repeat|retype|verifikasi)\b/.test(text)) return false
    return true
  }

  function isNewPasswordField(field) {
    if ((field.type || '').toLowerCase() !== 'password') return false
    const auto = ac(field)
    if (auto === 'new-password') return true
    return /\b(new|baru|confirm|confirmation|konfirmasi|ulang|ulangi|repeat|retype|create|buat)\b/.test(words(rawBlob(field)))
  }

  function classifyCredentialForm(form) {
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
    if (CHANGE_PATH.test(url)) {
      return { kind: 'change-password', reason: 'pengaturan ganti password' }
    }
    // Tombol "Change Password" yang satu form dengan login (SAP ESS: Log On +
    // Change Password dalam LOGIN_FORM yang sama) bukan dialog ganti password.
    // Dialog yang asli punya minimal dua kotak password (lama + baru), jadi
    // teks tombol saja tidak cukup untuk mengusir ikon dari form login.
    if (CHANGE_BTN.test(btn) && passwords.length >= 2) {
      return { kind: 'change-password', reason: 'tombol ganti password + dua field password' }
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

  function fieldSnapshot(el) {
    return {
      tag: (el.tagName || '').toLowerCase(),
      type: (el.type || '').toLowerCase(),
      name: el.name || '',
      id: el.id || '',
      autocomplete: el.autocomplete || el.getAttribute('autocomplete') || '',
      placeholder: el.placeholder || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      // A form may label the box with a real <label> and leave the input itself
      // anonymous. Without this, the shared-password stage of a two-step login is
      // invisible to the classifier and its company box is never recognised.
      label: labelText(el),
      inputMode: el.inputMode || '',
    }
  }

  /**
   * The text a person sees next to this box: <label for=...>, a wrapping <label>,
   * aria-labelledby, or the nearest table header. Empty when there is none.
   */
  function labelText(el) {
    try {
      const doc = el.ownerDocument || document
      const parts = []
      if (el.id) {
        const forLabel = doc.querySelector(`label[for="${el.id.replace(/"/g, '\\"')}"]`)
        if (forLabel && forLabel.textContent) parts.push(forLabel.textContent)
      }
      const wrap = el.closest && el.closest('label')
      if (wrap && wrap.textContent) parts.push(wrap.textContent)
      const ids = (el.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean)
      for (const id of ids) {
        const ref = doc.getElementById(id)
        if (ref && ref.textContent) parts.push(ref.textContent)
      }
      const cell = el.closest && el.closest('td')
      const head = cell && cell.parentElement && cell.parentElement.querySelector('th')
      if (head && head.textContent) parts.push(head.textContent)
      return parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, 200)
    } catch {
      return ''
    }
  }

  function snapshotForm(form, pageUrl) {
    const scope = form instanceof HTMLFormElement ? form : document
    const fields = [...scope.querySelectorAll('input, textarea')].map(fieldSnapshot)
    const buttons = [...scope.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]')]
      .map((el) => (el.value || el.textContent || '').trim())
      .filter(Boolean)
    return {
      id: form && form.id ? form.id : '',
      name: form && form.name ? form.name : '',
      action: form && form.action ? String(form.action) : '',
      method: form && form.method ? form.method : '',
      fields,
      buttons,
      pageUrl: pageUrl || location.href,
    }
  }

  function classifyAround(el) {
    const form = el instanceof Element ? el.closest('form') : null
    return classifyCredentialForm(snapshotForm(form, location.href))
  }

  function shapeAround(el) {
    const form = el instanceof Element ? el.closest('form') : null
    return credentialShape(snapshotForm(form, location.href))
  }

  function isUsernameOnlyStepAround(el) {
    const form = el instanceof Element ? el.closest('form') : null
    return isUsernameOnlyLoginStep(snapshotForm(form, location.href))
  }

  root.kunciLoginIntent = {
    classifyCredentialForm,
    classifyAround,
    credentialShape,
    shapeAround,
    isOtpField,
    tenantField,
    isUsernameOnlyLoginStep,
    isUsernameOnlyStepAround,
    snapshotForm,
    fieldSnapshot,
    isUsernameField,
    isConfidentUsernameField,
    isCurrentPasswordField,
    isNewPasswordField,
    shouldAutofillKind(kind) {
      return kind === 'login'
    },
    shouldOfferSaveKind(kind) {
      return kind === 'login' || kind === 'change-password'
    },
  }
})(typeof globalThis !== 'undefined' ? globalThis : window)
