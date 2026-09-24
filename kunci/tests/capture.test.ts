import { describe, expect, it } from 'vitest'
import { applyLoginCapture, decideLoginSave, isKunciAppUrl, loginTitleFromUrl, matchAppName } from '../src/lib/capture'
import type { Entry } from '../src/types'

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

describe('login capture', () => {
  it('does not save Kunci itself or empty passwords', () => {
    expect(isKunciAppUrl('http://127.0.0.1:8780/')).toBe(true)
    expect(isKunciAppUrl('https://kunci.tiftazani-cuciin.workers.dev/vault')).toBe(true)
    expect(isKunciAppUrl('https://github.com/login')).toBe(false)
    expect(decideLoginSave([], { url: 'https://github.com', username: 'a', password: '' }).action).toBe('skip')
    expect(decideLoginSave([], { url: 'http://127.0.0.1:8780/', username: 'a', password: 'x' }).action).toBe('skip')
  })

  it('creates a new site login and updates the same username', () => {
    const created = applyLoginCapture([], { url: 'https://github.com/login', username: 'tif', password: 'satu' }, 10, () => 'id-1')
    expect(created.changed).toBe('create')
    expect(created.entries[0]?.name).toBe('Github')
    expect(created.entries[0]?.url).toContain('github.com')

    const same = applyLoginCapture(created.entries, { url: 'https://github.com/session', username: 'tif', password: 'satu' })
    expect(same.changed).toBe('skip')

    const updated = applyLoginCapture(created.entries, { url: 'https://github.com/session', username: 'tif', password: 'dua' }, 20)
    expect(updated.changed).toBe('update')
    expect(updated.entries[0]?.password).toBe('dua')
    expect(updated.entries[0]?.history[0]?.password).toBe('satu')
  })

  it('keeps one site login and a payment PIN apart when both use the same account', () => {
    // One site, two prompts. Saving at the transfer step must not overwrite the
    // site login just because the host and username match.
    const site = login({ id: 'site', name: 'Bank', url: 'https://bank.example.com/login', username: 'tif', password: 'situs' })
    const pin = login({ id: 'pin', name: 'Bank', url: 'https://bank.example.com/transfer/confirm', username: 'tif', password: 'lama' })

    const atPin = decideLoginSave([site, pin], { url: 'https://bank.example.com/transfer/confirm', username: 'tif', password: 'baru' })
    expect(atPin).toEqual({ action: 'update', entryId: 'pin' })

    const atLogin = decideLoginSave([site, pin], { url: 'https://bank.example.com/login', username: 'tif', password: 'baru' })
    expect(atLogin).toEqual({ action: 'update', entryId: 'site' })

    // An unseen path with two same-account entries stays ambiguous: create rather
    // than silently overwrite one of them.
    const elsewhere = decideLoginSave([site, pin], { url: 'https://bank.example.com/session', username: 'tif', password: 'baru' })
    expect(elsewhere.action).toBe('create')

    // The PIN is really updated, and the site login keeps its own password.
    const next = applyLoginCapture([site, pin], { url: 'https://bank.example.com/transfer/confirm', username: 'tif', password: 'baru' }, 30)
    expect(next.changed).toBe('update')
    expect(next.entries.find((e) => e.id === 'pin')?.password).toBe('baru')
    expect(next.entries.find((e) => e.id === 'site')?.password).toBe('situs')
  })

  it('titles a host and matches a Mac app name', () => {
    expect(loginTitleFromUrl('https://accounts.google.com')).toBe('Accounts')
    const entries = [
      login({ id: '1', name: 'Slack kerja', appName: 'Slack', type: 'app', password: 'x' }),
      login({ id: '2', name: 'Mail', appName: 'Mail', password: 'y' }),
    ]
    expect(matchAppName(entries, 'Slack').map((e) => e.id)).toEqual(['1'])
  })
})
