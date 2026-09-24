import { describe, expect, it, beforeEach, vi } from 'vitest'
import { isPingPath, isSessionPath, normalizeApiPath } from '../src/lib/api-path'
import { cloudPutVault, probeCloudSession, readCloudToken, saveCloudToken } from '../src/lib/cloud'

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function htmlRes(status = 200): Response {
  return new Response('<!doctype html><title>Kunci</title>', {
    status,
    headers: { 'content-type': 'text/html; charset=UTF-8' },
  })
}

describe('normalizeApiPath', () => {
  it('strips trailing slashes and function prefixes', () => {
    expect(normalizeApiPath('/api/session/')).toBe('/api/session')
    expect(normalizeApiPath('/.netlify/functions/api/session')).toBe('/api/session')
    expect(normalizeApiPath('/.netlify/functions/api')).toBe('/api')
  })

  it('recognizes ping and session aliases', () => {
    expect(isPingPath('/api/ping')).toBe(true)
    expect(isPingPath('/kunci-status')).toBe(true)
    expect(isSessionPath('/api/me')).toBe(true)
    expect(isSessionPath('/api/session')).toBe(true)
    expect(isPingPath('/api/session')).toBe(false)
  })
})

describe('probeCloudSession', () => {
  it('treats 401 JSON from /api/session as signed out, not missing', async () => {
    const state = await probeCloudSession({
      publicHost: true,
      token: null,
      fetch: async (url) => {
        if (url.endsWith('/api/ping') || url.endsWith('/kunci-status')) return htmlRes()
        if (url.endsWith('/api/me')) return jsonRes(401, { ok: false })
        if (url.endsWith('/api/session')) return jsonRes(401, { ok: false })
        return htmlRes()
      },
    })
    expect(state).toEqual({ signedIn: false, configured: true })
  })

  it('retries without cookies when Safari rejects a 401 session fetch', async () => {
    const state = await probeCloudSession({
      publicHost: true,
      token: null,
      fetch: async (url, init) => {
        if (url.endsWith('/api/ping') || url.endsWith('/kunci-status')) return htmlRes()
        if (url.endsWith('/api/me') || url.endsWith('/api/session')) {
          if (init?.credentials === 'include') throw new TypeError('Load failed')
          return jsonRes(401, { ok: false })
        }
        return htmlRes()
      },
    })
    expect(state.configured).toBe(true)
    expect(state.signedIn).toBe(false)
  })

  it('uses /kunci-status when /api/* is blocked', async () => {
    const state = await probeCloudSession({
      publicHost: true,
      token: null,
      fetch: async (url) => {
        if (url.includes('/api/')) throw new TypeError('Failed to fetch')
        if (url.endsWith('/kunci-status')) return jsonRes(200, { ok: true })
        throw new TypeError('Failed to fetch')
      },
    })
    expect(state).toEqual({ signedIn: false, configured: true })
  })

  it('reads a signed-in email from /api/me', async () => {
    const state = await probeCloudSession({
      publicHost: true,
      token: null,
      fetch: async (url) => {
        if (url.endsWith('/api/ping')) return jsonRes(200, { ok: true })
        if (url.endsWith('/api/me')) return jsonRes(200, { ok: true, email: 'tiftazani.khara@gmail.com' })
        return jsonRes(401, { ok: false })
      },
    })
    expect(state).toEqual({
      signedIn: true,
      email: 'tiftazani.khara@gmail.com',
      configured: true,
    })
  })

  it('marks HTML-only replies as not deployed', async () => {
    const state = await probeCloudSession({
      publicHost: true,
      token: null,
      fetch: async () => htmlRes(),
    })
    expect(state).toEqual({ signedIn: false, configured: false, error: 'missing' })
  })

  it('marks total fetch failure as a network error', async () => {
    const state = await probeCloudSession({
      publicHost: true,
      token: null,
      fetch: async () => {
        throw new TypeError('Failed to fetch')
      },
    })
    expect(state).toEqual({ signedIn: false, configured: false, error: 'network' })
  })

  it('falls back to the public origin from localhost', async () => {
    const state = await probeCloudSession({
      publicHost: false,
      token: null,
      cloudUrl: 'https://kunci.tiftazani-cuciin.workers.dev',
      fetch: async (url) => {
        if (url.startsWith('/')) return htmlRes()
        if (url === 'https://kunci.tiftazani-cuciin.workers.dev/api/ping') return jsonRes(200, { ok: true })
        if (url === 'https://kunci.tiftazani-cuciin.workers.dev/api/me') return jsonRes(401, { ok: false })
        return htmlRes()
      },
    })
    expect(state).toEqual({ signedIn: false, configured: true })
  })

  it('lets localhost skip the OTP gate when the vault is already on this machine', async () => {
    // The gate used to open for localhost whenever the cloud answered, so a
    // missing RESEND_API_KEY locked the user out of a vault that was sitting
    // right there in IndexedDB. A local copy means localhost can carry on and
    // sync in the background once the OTP goes through.
    const state = await probeCloudSession({
      publicHost: false,
      token: null,
      localVault: true,
      cloudUrl: 'https://kunci.tiftazani-cuciin.workers.dev',
      fetch: async (url) => {
        if (url.startsWith('/')) return htmlRes()
        if (url === 'https://kunci.tiftazani-cuciin.workers.dev/api/ping') return jsonRes(200, { ok: true })
        if (url === 'https://kunci.tiftazani-cuciin.workers.dev/api/me') return jsonRes(401, { ok: false })
        return htmlRes()
      },
    })
    expect(state).toEqual({ signedIn: false, configured: true, localOnly: true })
  })

  it('still asks a public host for the code even when a local copy exists', async () => {
    // The public site has no IndexedDB copy of its own, so it must not skip the gate.
    const state = await probeCloudSession({
      publicHost: true,
      token: null,
      localVault: true,
      fetch: async (url) => {
        if (url.endsWith('/api/ping') || url.endsWith('/kunci-status')) return jsonRes(200, { ok: true })
        if (url.endsWith('/api/me') || url.endsWith('/api/session')) return jsonRes(401, { ok: false })
        return htmlRes()
      },
    })
    expect(state).toEqual({ signedIn: false, configured: true })
    expect(state.localOnly).toBeUndefined()
  })

  it('asks for the code when the user explicitly opened the gate', async () => {
    // Settings has a button for this. Without it, localhost would jump straight
    // into the vault and the code screen would be unreachable.
    const state = await probeCloudSession({
      publicHost: false,
      token: null,
      localVault: true,
      requireGate: true,
      cloudUrl: 'https://kunci.tiftazani-cuciin.workers.dev',
      fetch: async (url) => {
        if (url.startsWith('/')) return htmlRes()
        if (url.endsWith('/api/ping')) return jsonRes(200, { ok: true })
        if (url.endsWith('/api/me')) return jsonRes(401, { ok: false })
        return htmlRes()
      },
    })
    expect(state).toEqual({ signedIn: false, configured: true })
    expect(state.localOnly).toBeUndefined()
  })
})

describe('a dead cloud session', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    const store = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
      location: { hostname: '127.0.0.1', host: '127.0.0.1:8780' },
    })
  })

  it('drops the dead token instead of warning on every save', async () => {
    // A 12-hour session token stays in localStorage after it expires. Before
    // this, every single save retried it, got 401, and pushed "Sesi cloud habis"
    // — the user saw the warning again and again with no way to make it stop.
    saveCloudToken('expired-token')
    expect(readCloudToken()).toBe('expired-token')

    vi.stubGlobal('fetch', async () => jsonRes(401, { error: 'Sesi tidak valid' }))
    await expect(cloudPutVault({ v: 1 } as never)).rejects.toThrow(/Sesi cloud habis/)

    expect(readCloudToken()).toBeNull()
  })

  it('keeps the token when the save fails for another reason', async () => {
    saveCloudToken('good-token')
    vi.stubGlobal('fetch', async () => jsonRes(500, { error: 'Server sedang error' }))
    await expect(cloudPutVault({ v: 1 } as never)).rejects.toThrow(/Server sedang error/)
    expect(readCloudToken()).toBe('good-token')
  })
})
