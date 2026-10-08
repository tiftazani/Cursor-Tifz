export type LoginOutcome = 'success' | 'failure' | 'unknown'

export interface LoginOutcomeInput {
  submittedUrl: string
  currentUrl: string
  passwordFieldVisible: boolean
  loginFormVisible: boolean
  passwordFieldInvalid?: boolean
  pageText?: string
  elapsedMs: number
}

const LOGIN_PATH = /\/(login|signin|sign-in|masuk|session|auth|sso|accounts\/login)(\/|$|\?)/i

const FAIL_TEXT =
  /\b(invalid (email|username|password|credentials|login)|incorrect password|wrong password|login failed|sign[- ]in failed|authentication failed|access denied|could(n't| not) log you in|unrecognized (email|username|password)|user not found|account not found|kata sandi salah|password salah|username atau password|email atau password|gagal masuk|login gagal|kredensial (salah|tidak)|tidak sesuai|akun tidak (ditemukan|dikenal)|please check your (email|username|password))\b/i

export function pageLooksLikeAuthFailure(text: string): boolean {
  return FAIL_TEXT.test((text || '').slice(0, 8000))
}

export function looksLikeLoginUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return LOGIN_PATH.test(`${u.pathname}${u.search}`)
  } catch {
    return LOGIN_PATH.test(url)
  }
}

/**
 * The host of a URL, or '' when it cannot be read.
 *
 * The port is kept on loopback: `127.0.0.1:5178` and `127.0.0.1:8780` are two
 * different applications on one machine, so a login that succeeded on one must not
 * count as success on the other. Mirrors hostFromUrl in src/lib/match.ts.
 */
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

function hostKey(url: URL): string {
  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  // URL already drops the default port, so ":80"/":443" never shows up here.
  return LOOPBACK_HOSTS.has(host) && url.port ? `${host}:${url.port}` : host
}

function authKey(url: string): string {
  try {
    const u = new URL(url)
    const path = (u.pathname.replace(/\/+$/, '') || '/').toLowerCase()
    return `${hostKey(u)}${path}`
  } catch {
    return (url.split('?')[0] || url).toLowerCase()
  }
}

export function sameAuthPage(a: string, b: string): boolean {
  return authKey(a) === authKey(b)
}

export function sameSiteHost(a: string, b: string): boolean {
  try {
    const ha = hostKey(new URL(a))
    const hb = hostKey(new URL(b))
    return Boolean(ha && ha === hb)
  } catch {
    return false
  }
}

/** Save only after a login looks successful. Failed or still-unknown attempts must not write the vault. */
export function inferLoginOutcome(input: LoginOutcomeInput): LoginOutcome {
  const elapsed = Math.max(0, input.elapsedMs || 0)
  if (!sameSiteHost(input.submittedUrl, input.currentUrl)) return 'unknown'
  const failText = pageLooksLikeAuthFailure(input.pageText || '')
  const stillForm = Boolean(input.passwordFieldVisible || input.loginFormVisible)
  const leftLogin = !sameAuthPage(input.submittedUrl, input.currentUrl) && !looksLikeLoginUrl(input.currentUrl)

  if (input.passwordFieldInvalid && elapsed >= 250) return 'failure'
  if (failText && elapsed >= 250) return 'failure'
  if (!stillForm && elapsed >= 400) return 'success'
  if (leftLogin && !input.passwordFieldVisible && elapsed >= 400) return 'success'
  return 'unknown'
}
