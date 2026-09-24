import { describe, expect, it } from 'vitest'
import { domainsMatch, entryMatchesPage, hostFromUrl, layerFromUrl } from '../src/lib/match'
import { isUsernameOnlyLoginStep, type FormSnapshot } from '../src/lib/login-intent'
import {
  domainsMatch as extDomainsMatch,
  hostFromUrl as extHostFromUrl,
  layerFromUrl as extLayerFromUrl,
  matchesForUrl,
} from '../extension/crypto.js'

// extension/login-intent.js is an IIFE that parks its API on globalThis, not a module.
// Importing it for the side effect is the only way to compare the two copies.
// @ts-ignore -- no type declarations for the plain-JS IIFE
await import('../extension/login-intent.js')
type ExtIntent = { isUsernameOnlyLoginStep: (form: FormSnapshot) => boolean }
const extIntent = (globalThis as unknown as { kunciLoginIntent: ExtIntent }).kunciLoginIntent

// The extension loads plain JS from extension/, so the matching logic exists twice.
// This suite fails the moment the two copies disagree.
const pages = [
  'https://github.com/login',
  'https://accounts.google.com',
  'https://tiftazani-cuciin.workers.dev',
  'https://google.evil.com',
  'https://www.netflix.com/browse',
  'http://localhost:3000/login',
  'not a url',
  '',
]
const entries = [
  { id: 'a', type: 'login', name: 'GitHub', url: 'https://github.com' },
  { id: 'b', type: 'login', name: 'tifta' },
  { id: 'c', type: 'login', name: 'Gmail', url: 'https://google.com' },
  { id: 'd', type: 'login', name: 'Netflix', url: 'https://netflix.com' },
  { id: 'e', type: 'note', name: 'Catatan', url: 'https://github.com' },
  { id: 'f', type: 'login', name: 'Local', url: 'http://localhost:3000' },
  { id: 'g', type: 'login', name: 'Google', url: 'https://google.com', urls: ['https://mail.google.com'] },
]

describe('extension and web matching agree', () => {
  it('hostFromUrl is identical', () => {
    for (const p of pages) expect(extHostFromUrl(p)).toBe(hostFromUrl(p))
  })

  it('domainsMatch is identical', () => {
    for (const a of pages) {
      for (const b of pages) expect(extDomainsMatch(a, b)).toBe(domainsMatch(a, b))
    }
  })

  it('matchesForUrl offers exactly what entryMatchesPage offers', () => {
    for (const p of pages) {
      const web = entries.filter((e) => e.type !== 'note' && entryMatchesPage(e, p)).map((e) => e.id)
      const ext = matchesForUrl(entries, p).map((e) => e.id)
      expect(ext).toEqual(web)
    }
  })

  it('isUsernameOnlyLoginStep is identical in both copies', () => {
    const cases: FormSnapshot[] = [
      {
        id: '', name: '', action: '', method: 'post', buttons: ['Continue'],
        pageUrl: 'https://www.agoda.com/account/signin.html?ottoken=abc',
        fields: [{ tag: 'input', type: 'email', name: 'email', id: '', autocomplete: '', placeholder: 'id@email.com', ariaLabel: '' }],
      },
      {
        id: '', name: '', action: '', method: 'post', buttons: ['Create account'],
        pageUrl: 'https://example.com/register',
        fields: [{ tag: 'input', type: 'email', name: 'email', id: '', autocomplete: '', placeholder: '', ariaLabel: '' }],
      },
      {
        id: '', name: '', action: '', method: 'post', buttons: ['Sign in'],
        pageUrl: 'https://example.com/login',
        fields: [
          { tag: 'input', type: 'email', name: 'email', id: '', autocomplete: 'username', placeholder: '', ariaLabel: '' },
          { tag: 'input', type: 'password', name: 'password', id: '', autocomplete: 'current-password', placeholder: '', ariaLabel: '' },
        ],
      },
      {
        id: '', name: '', action: '', method: 'post', buttons: ['Search'],
        pageUrl: 'https://example.com/',
        fields: [{ tag: 'input', type: 'text', name: 'q', id: '', autocomplete: '', placeholder: 'Cari', ariaLabel: '' }],
      },
    ]
    for (const c of cases) {
      expect(extIntent.isUsernameOnlyLoginStep(c), JSON.stringify(c.pageUrl)).toBe(isUsernameOnlyLoginStep(c))
    }
  })

  it('layerFromUrl is identical in both copies', () => {
    const urls = [
      'https://bank.example.com/login',
      'https://bank.example.com/transfer/confirm',
      'https://bank.example.com/',
      'https://bank.example.com',
      'bank.example.com/login',
      'not a url',
      '',
    ]
    for (const u of urls) {
      expect(extLayerFromUrl(u), u).toBe(layerFromUrl(u))
    }
  })

  it('puts the login saved for this exact path first', () => {
    const rows = [
      { id: 'root', type: 'login', name: 'Bank', url: 'https://bank.example.com' },
      { id: 'site', type: 'login', name: 'Bank', url: 'https://bank.example.com/login' },
      { id: 'pin', type: 'login', name: 'Bank', url: 'https://bank.example.com/transfer/confirm' },
    ]
    // At the transfer prompt the PIN entry leads, but nothing is hidden.
    expect(matchesForUrl(rows, 'https://bank.example.com/transfer/confirm').map((e: { id: string }) => e.id)).toEqual([
      'pin',
      'root',
      'site',
    ])
    // At the login prompt the login entry leads.
    expect(matchesForUrl(rows, 'https://bank.example.com/login').map((e: { id: string }) => e.id)).toEqual([
      'site',
      'root',
      'pin',
    ])
  })
})
