import { describe, expect, it } from 'vitest'
import { isPingPath, isSessionPath, normalizeApiPath } from '../src/lib/api-path'
import { probeCloudSession } from '../src/lib/cloud'

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
      cloudUrl: 'https://kunci-tifta.netlify.app',
      fetch: async (url) => {
        if (url.startsWith('/')) return htmlRes()
        if (url === 'https://kunci-tifta.netlify.app/api/ping') return jsonRes(200, { ok: true })
        if (url === 'https://kunci-tifta.netlify.app/api/me') return jsonRes(401, { ok: false })
        return htmlRes()
      },
    })
    expect(state).toEqual({ signedIn: false, configured: true })
  })
})
