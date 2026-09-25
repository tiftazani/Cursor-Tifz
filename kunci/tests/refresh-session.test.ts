import { beforeEach, describe, expect, it, vi } from 'vitest'
import { refreshSession } from '../src/lib/refresh-session'

const stored = new Map<string, unknown>()
const tab = new Map<string, string>()
vi.stubGlobal('sessionStorage', {
  getItem: (key: string) => tab.get(key) ?? null,
  setItem: (key: string, value: string) => { tab.set(key, value) },
  removeItem: (key: string) => { tab.delete(key) },
})
vi.mock('../src/db/idb', () => ({ vaultDb: {
  getRefreshSession: async () => stored.get('session'),
  setRefreshSession: async (value: unknown) => { stored.set('session', value) },
  clearRefreshSession: async () => { stored.delete('session') },
} }))

const blob = { v: 2, wrap: 'wrap', salt: 'salt', data: 'cipher' } as never
let key: CryptoKey
beforeEach(async () => {
  stored.clear(); tab.clear()
  key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
})

describe('refresh session', () => {
  it('restores only the same tab before inactivity expires', async () => {
    await refreshSession.save(key, blob, 1000)
    expect(await refreshSession.restore(blob, 1200, 300)).toBe(key)
    tab.clear()
    expect(await refreshSession.restore(blob, 1200, 300)).toBeNull()
  })
  it('does not reset inactivity on refresh', async () => {
    await refreshSession.save(key, blob, 1000)
    expect(await refreshSession.restore(blob, 1601, 0.5)).toBeNull()
  })
  it('rejects an extractable key even with a valid tab token', async () => {
    const raw = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
    await refreshSession.save(raw, blob, 1000)
    expect(await refreshSession.restore(blob, 1200, 300)).toBeNull()
  })
  it('cleans the earlier JavaScript-readable session value', () => {
    tab.set('kunci-refresh-session', 'unsafe')
    refreshSession.cleanupOld()
    expect(tab.has('kunci-refresh-session')).toBe(false)
  })
  it('rejects a replaced wrap and clears on explicit lock', async () => {
    await refreshSession.save(key, blob, 1000)
    expect(await refreshSession.restore({ ...blob, wrap: 'other' }, 1100, 300)).toBeNull()
    await refreshSession.clear()
    expect(stored.size).toBe(0)
    expect(tab.size).toBe(0)
  })
})
