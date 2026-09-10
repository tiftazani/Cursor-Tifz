import { describe, expect, it } from 'vitest'
import {
  inferLoginOutcome,
  pageLooksLikeAuthFailure,
  sameAuthPage,
  sameSiteHost,
  type LoginOutcomeInput,
} from '../src/lib/login-outcome'

function outcome(partial: Partial<LoginOutcomeInput> & Pick<LoginOutcomeInput, 'elapsedMs'>): ReturnType<typeof inferLoginOutcome> {
  return inferLoginOutcome({
    submittedUrl: 'https://mail.example.com/login',
    currentUrl: 'https://mail.example.com/login',
    passwordFieldVisible: true,
    loginFormVisible: true,
    pageText: '',
    ...partial,
  })
}

describe('login outcome', () => {
  it('does not treat a just-submitted login form as success', () => {
    expect(outcome({ elapsedMs: 0 })).toBe('unknown')
    expect(outcome({ elapsedMs: 800 })).toBe('unknown')
    expect(
      outcome({
        elapsedMs: 200,
        passwordFieldVisible: false,
        loginFormVisible: false,
      }),
    ).toBe('unknown')
  })

  it('fails when the page shows a wrong-password error', () => {
    expect(pageLooksLikeAuthFailure('Kata sandi salah. Coba lagi.')).toBe(true)
    expect(
      outcome({
        elapsedMs: 400,
        pageText: 'Incorrect password. Try again.',
      }),
    ).toBe('failure')
    expect(
      outcome({
        elapsedMs: 400,
        passwordFieldInvalid: true,
        pageText: '',
      }),
    ).toBe('failure')
  })

  it('succeeds after leaving the login form or login URL', () => {
    expect(
      outcome({
        elapsedMs: 600,
        passwordFieldVisible: false,
        loginFormVisible: false,
        currentUrl: 'https://mail.example.com/inbox',
      }),
    ).toBe('success')
    expect(
      outcome({
        elapsedMs: 600,
        passwordFieldVisible: false,
        loginFormVisible: false,
        currentUrl: 'https://mail.example.com/login',
      }),
    ).toBe('success')
  })

  it('stays unknown while the login form is still on screen without an error', () => {
    expect(sameAuthPage('https://a.com/login?x=1', 'https://a.com/login?error=1')).toBe(true)
    expect(sameSiteHost('https://mail.example.com/login', 'https://mail.example.com/inbox')).toBe(true)
    expect(sameSiteHost('https://mail.example.com/login', 'https://other.example.net/')).toBe(false)
    expect(
      outcome({
        elapsedMs: 2500,
        passwordFieldVisible: true,
        loginFormVisible: true,
        currentUrl: 'https://mail.example.com/login?error=1',
      }),
    ).toBe('unknown')
    expect(
      outcome({
        elapsedMs: 2000,
        passwordFieldVisible: false,
        loginFormVisible: false,
        currentUrl: 'https://other.example.net/',
      }),
    ).toBe('unknown')
  })
})
