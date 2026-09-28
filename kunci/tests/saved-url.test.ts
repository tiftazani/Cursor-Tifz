import { describe, expect, it } from 'vitest'
import { applyLoginCapture, decideLoginSave } from '../src/lib/capture'
import { storedUrl } from '../src/lib/site'
import {
  applyLoginCapture as extApply,
  layerFromUrl as extLayerFromUrl,
  matchesForUrl,
} from '../extension/crypto.js'
import type { Entry } from '../src/types'

// A login page routinely carries one-time material in its query string. Agoda's sign-in
// page is `/account/signin.html?ottoken=<JWT>&returnurl=…`, measured on the live page.
// Saving that URL put a live token in the vault, and because the token is new on every
// visit the entry's url list grew by one per login instead of settling on one address.
const TOKEN_A = 'eyJhbGciOiJBMjU2S1ciLCJlbG0iOiJBMjU2Q0JDLUhTNTEyIn0.aaa'
const TOKEN_B = 'eyJhbGciOiJBMjU2S1ciLCJlbG0iOiJBMjU2Q0JDLUhTNTEyIn0.bbb'
const page = (token: string) =>
  `https://www.agoda.com/account/signin.html?ottoken=${TOKEN_A.slice(0, 8)}${token}&returnurl=%2Faccount%2Fsignin.html`

function login(partial: Partial<Entry> & Pick<Entry, 'id' | 'name'>): Entry {
  return {
    type: 'login',
    urls: [],
    tags: [],
    favorite: false,
    customFields: [],
    history: [],
    createdAt: 1,
    updatedAt: 1,
    ...partial,
  }
}

describe('what a saved login stores as its address', () => {
  it('keeps the address and drops the query', () => {
    expect(storedUrl(page('aaa'))).toBe('https://www.agoda.com/account/signin.html')
    expect(storedUrl('https://github.com/login?next=%2Fissues')).toBe('https://github.com/login')
    expect(storedUrl('https://bank.example.com/transfer/confirm?ref=mail')).toBe(
      'https://bank.example.com/transfer/confirm',
    )
  })

  it('drops a fragment too, and the slash after a bare host', () => {
    expect(storedUrl('https://www.agoda.com/account/signin.html#section')).toBe(
      'https://www.agoda.com/account/signin.html',
    )
    expect(storedUrl('https://github.com/')).toBe('https://github.com')
    expect(storedUrl('https://github.com')).toBe('https://github.com')
  })

  it('never lets userinfo reach the vault', () => {
    // `https://user:pass@host/` is a credential in the URL itself.
    expect(storedUrl('https://user:secret@bank.example.com/login?x=1')).toBe(
      'https://bank.example.com/login',
    )
  })

  it('leaves input it cannot parse exactly as it came', () => {
    // Dropping the address would lose it, and there is no query to strip from a
    // string that is not a URL.
    expect(storedUrl('not a url')).toBe('not a url')
    expect(storedUrl('')).toBe('')
    expect(storedUrl(undefined as unknown as string)).toBe('')
  })

  it('reads a bare host as https, so a pasted address still normalises', () => {
    expect(storedUrl('bank.example.com/login?token=1')).toBe('https://bank.example.com/login')
  })

  it('does not change which entries are offered', () => {
    // The fix would be pointless if it broke matching: the address is read by host and
    // by path, and neither of those lives in the query string.
    const entries = [
      { id: 'root', type: 'login', name: 'Agoda', url: 'https://www.agoda.com' },
      { id: 'signin', type: 'login', name: 'Agoda', url: 'https://www.agoda.com/account/signin.html' },
    ]
    expect(matchesForUrl(entries, page('zzz')).map((e: { id: string }) => e.id)).toEqual(['signin', 'root'])
    expect(extLayerFromUrl(page('zzz'))).toBe('/account/signin.html')
  })
})

describe('saving a login does not keep the one-time token', () => {
  it('stores the address without the query', () => {
    const { entries } = applyLoginCapture(
      [],
      { url: page('aaa'), username: 'tifta@example.com', password: 'RAHASIA-1' },
      10,
      () => 'id-1',
    )
    expect(entries[0]?.url).toBe('https://www.agoda.com/account/signin.html')
    expect(entries[0]?.url).not.toContain('ottoken')
  })

  it('does not grow the url list on every login', () => {
    // This is the part that made the fix necessary: a fresh token per visit meant a
    // fresh url per visit, so one account ended up with a list that grew forever.
    let entries = applyLoginCapture(
      [],
      { url: page('aaa'), username: 'tifta@example.com', password: 'RAHASIA-1' },
      10,
      () => 'id-1',
    ).entries
    for (const [i, token] of ['bbb', 'ccc', 'ddd'].entries()) {
      entries = applyLoginCapture(
        entries,
        { url: page(token), username: 'tifta@example.com', password: `RAHASIA-${i + 2}` },
        20 + i,
      ).entries
    }
    expect(entries).toHaveLength(1)
    expect(entries[0]?.urls).toEqual(['https://www.agoda.com/account/signin.html'])
  })

  it('cleans an entry that already carries a token, next time it is used', () => {
    // Entries saved before the fix are already in the vault. They cannot be reached
    // without a write, and the write that happens is this one.
    const before = login({
      id: 'old',
      name: 'Agoda',
      url: page('old'),
      urls: [page('old'), page('older')],
      username: 'tifta@example.com',
      password: 'lama',
    })
    const { entries, changed } = applyLoginCapture(
      [before],
      { url: page('new'), username: 'tifta@example.com', password: 'baru' },
      30,
    )
    expect(changed).toBe('update')
    expect(entries[0]?.url).toBe('https://www.agoda.com/account/signin.html')
    expect(entries[0]?.urls).toEqual(['https://www.agoda.com/account/signin.html'])
    expect(JSON.stringify(entries[0])).not.toContain('ottoken')
  })

  it('still recognises the same login, so it updates instead of duplicating', () => {
    // The decision runs on the raw capture url, before the address is rewritten, so a
    // login saved from the bare address is found by a capture that carries a token.
    const saved = login({
      id: 'one',
      name: 'Agoda',
      url: 'https://www.agoda.com/account/signin.html',
      username: 'tifta@example.com',
      password: 'lama',
    })
    const decision = decideLoginSave([saved], {
      url: page('aaa'),
      username: 'tifta@example.com',
      password: 'baru',
    })
    expect(decision).toEqual({ action: 'update', entryId: 'one' })
  })
})

describe('the extension copy agrees with the web copy', () => {
  it('stores the same address for the same capture', () => {
    const capture = { url: page('aaa'), username: 'tifta@example.com', password: 'RAHASIA-1' }
    const web = applyLoginCapture([], capture, 10, () => 'id-1').entries
    const ext = extApply([], capture, 10)
    expect(ext.entries[0].url).toBe(web[0]?.url)
    expect(ext.entries[0].urls).toEqual(web[0]?.urls)
  })

  it('cleans an old entry the same way', () => {
    const before = login({
      id: 'old',
      name: 'Agoda',
      url: page('old'),
      urls: [page('old')],
      username: 'tifta@example.com',
      password: 'lama',
    })
    const capture = { url: page('new'), username: 'tifta@example.com', password: 'baru' }
    const web = applyLoginCapture([before], capture, 30).entries
    const ext = extApply([before], capture, 30).entries
    expect(ext[0].url).toBe(web[0]?.url)
    expect(ext[0].urls).toEqual(web[0]?.urls)
  })
})
