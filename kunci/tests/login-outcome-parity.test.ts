import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createContext, runInContext } from 'node:vm'
import {
  inferLoginOutcome,
  looksLikeLoginUrl,
  pageLooksLikeAuthFailure,
  sameAuthPage,
  sameSiteHost,
} from '../src/lib/login-outcome'

/**
 * src/lib/login-outcome.ts and extension/login-outcome.js are two copies of the same
 * logic, and drift between such pairs has already caused real bugs twice in this repo
 * (extension/crypto.js lost the `appName` fallback, and `isKunciAppUrl` disagreed on
 * http vs https). The copies are compared by running both against the same inputs
 * rather than by reading the source, so a divergence fails here.
 */
// The extension file runs in a page, so `URL` is a global there. A bare vm context has
// no globals at all, and without URL every new URL(...) threw and fell into the catch
// branch — which made the comparison look like drift when it was the harness.
const sandbox = createContext({ URL })
runInContext(readFileSync(join(__dirname, '..', 'extension/login-outcome.js'), 'utf8'), sandbox)
const ext = (sandbox as { kunciLoginOutcome: Record<string, (...args: never[]) => unknown> }).kunciLoginOutcome

describe('login-outcome parity between src/lib and the extension', () => {
  it('runs the extension copy with a real URL global', () => {
    expect(typeof (sandbox as { URL?: unknown }).URL).toBe('function')
  })

  it('exposes the same functions', () => {
    expect(Object.keys(ext).sort()).toEqual([
      'inferLoginOutcome',
      'looksLikeLoginUrl',
      'pageLooksLikeAuthFailure',
      'sameAuthPage',
      'sameSiteHost',
    ])
  })

  const texts = [
    'Invalid username or password',
    'Kata sandi salah, coba lagi',
    'Login gagal',
    'Please check your email',
    'Welcome back',
    '',
  ]

  it('agrees on failure text', () => {
    for (const t of texts) {
      expect(ext.pageLooksLikeAuthFailure(t), t).toBe(pageLooksLikeAuthFailure(t))
    }
  })

  const urls = [
    'https://bank.example.com/login',
    'https://bank.example.com/masuk?next=1',
    'https://bank.example.com/dashboard',
    'https://federation-sts.accenture.com/',
    'not a url',
  ]

  it('agrees on login urls', () => {
    for (const u of urls) {
      expect(ext.looksLikeLoginUrl(u), u).toBe(looksLikeLoginUrl(u))
    }
  })

  it('agrees on same-page and same-host comparisons', () => {
    for (const a of urls) {
      for (const b of urls) {
        expect(ext.sameAuthPage(a, b), `${a} vs ${b}`).toBe(sameAuthPage(a, b))
        expect(ext.sameSiteHost(a, b), `${a} vs ${b}`).toBe(sameSiteHost(a, b))
      }
    }
  })

  it('agrees on the outcome for every combination that matters', () => {
    const cases = [
      { submittedUrl: 'https://a.example/login', currentUrl: 'https://a.example/home', passwordFieldVisible: false, loginFormVisible: false, elapsedMs: 900 },
      { submittedUrl: 'https://a.example/login', currentUrl: 'https://a.example/login', passwordFieldVisible: true, loginFormVisible: true, elapsedMs: 900 },
      { submittedUrl: 'https://a.example/login', currentUrl: 'https://a.example/login', passwordFieldVisible: true, loginFormVisible: true, passwordFieldInvalid: true, elapsedMs: 300 },
      { submittedUrl: 'https://a.example/login', currentUrl: 'https://a.example/login', passwordFieldVisible: true, loginFormVisible: true, pageText: 'Kata sandi salah', elapsedMs: 500 },
      // Between the 25 ms and 250 ms thresholds: a failure text must NOT be read as a
      // failure yet, and a changed threshold in either copy has to show up here.
      { submittedUrl: 'https://a.example/login', currentUrl: 'https://a.example/login', passwordFieldVisible: true, loginFormVisible: true, pageText: 'Kata sandi salah', elapsedMs: 100 },
      { submittedUrl: 'https://a.example/login', currentUrl: 'https://a.example/login', passwordFieldVisible: true, loginFormVisible: true, passwordFieldInvalid: true, elapsedMs: 100 },
      { submittedUrl: 'https://a.example/login', currentUrl: 'https://b.example/home', passwordFieldVisible: false, loginFormVisible: false, elapsedMs: 900 },
      { submittedUrl: 'https://a.example/login', currentUrl: 'https://a.example/login', passwordFieldVisible: false, loginFormVisible: false, elapsedMs: 100 },
    ]
    for (const c of cases) {
      expect(ext.inferLoginOutcome(c), JSON.stringify(c)).toBe(inferLoginOutcome(c))
    }
  })

  it('still refuses to call a login successful too early', () => {
    // Guards the thresholds themselves, so a "parity" that is wrong in both copies fails.
    expect(inferLoginOutcome({ submittedUrl: 'https://a.example/login', currentUrl: 'https://a.example/home', passwordFieldVisible: false, loginFormVisible: false, elapsedMs: 100 })).toBe('unknown')
    expect(inferLoginOutcome({ submittedUrl: 'https://a.example/login', currentUrl: 'https://a.example/home', passwordFieldVisible: false, loginFormVisible: false, elapsedMs: 900 })).toBe('success')
  })
})
