(function (root) {
  const LOGIN_PATH = /\/(login|signin|sign-in|masuk|session|auth|sso|accounts\/login)(\/|$|\?)/i
  const FAIL_TEXT =
    /\b(invalid (email|username|password|credentials|login)|incorrect password|wrong password|login failed|sign[- ]in failed|authentication failed|access denied|could(n't| not) log you in|unrecognized (email|username|password)|user not found|account not found|kata sandi salah|password salah|username atau password|email atau password|gagal masuk|login gagal|kredensial (salah|tidak)|tidak sesuai|akun tidak (ditemukan|dikenal)|please check your (email|username|password))\b/i

  function pageLooksLikeAuthFailure(text) {
    return FAIL_TEXT.test((text || '').slice(0, 8000))
  }

  function looksLikeLoginUrl(url) {
    try {
      const u = new URL(url)
      return LOGIN_PATH.test(`${u.pathname}${u.search}`)
    } catch {
      return LOGIN_PATH.test(url)
    }
  }

  function authKey(url) {
    try {
      const u = new URL(url)
      const host = u.hostname.replace(/^www\./, '').toLowerCase()
      const path = (u.pathname.replace(/\/+$/, '') || '/').toLowerCase()
      return `${host}${path}`
    } catch {
      return (url.split('?')[0] || url).toLowerCase()
    }
  }

  function sameAuthPage(a, b) {
    return authKey(a) === authKey(b)
  }

  function sameSiteHost(a, b) {
    try {
      const ha = new URL(a).hostname.replace(/^www\./, '').toLowerCase()
      const hb = new URL(b).hostname.replace(/^www\./, '').toLowerCase()
      return Boolean(ha && ha === hb)
    } catch {
      return false
    }
  }

  function inferLoginOutcome(input) {
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

  root.kunciLoginOutcome = {
    pageLooksLikeAuthFailure,
    looksLikeLoginUrl,
    sameAuthPage,
    sameSiteHost,
    inferLoginOutcome,
  }
})(typeof globalThis !== 'undefined' ? globalThis : window)
