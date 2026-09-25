import { isEncryptedBlob } from './crypto'
import type { EncryptedBlob } from '../types'
import { RECOVERY_EMAIL } from './account'
import { DEFAULT_CLOUD_URL } from './allowed-origins'
import { hasLocalVault } from '../db/idb'

const TOKEN_KEY = 'kunci_cloud_token'

/** Set once when the user asks for the email gate; consumed by sessionStatus. */
const FORCE_GATE_KEY = 'kunci_force_gate'

/**
 * Ask for the email code on the next load even though a local vault exists.
 * Settings uses it so the gate is still reachable: without this, localhost would
 * open straight into the vault and there would be no way back to the code screen.
 */
export function requestCloudGate(): void {
  try {
    window.sessionStorage.setItem(FORCE_GATE_KEY, '1')
  } catch {
    /* private mode */
  }
}

function takeGateRequest(): boolean {
  try {
    const on = window.sessionStorage.getItem(FORCE_GATE_KEY) === '1'
    if (on) window.sessionStorage.removeItem(FORCE_GATE_KEY)
    return on
  } catch {
    return false
  }
}

export function isPublicHost(): boolean {
  const host = window.location.hostname
  return host !== 'localhost' && host !== '127.0.0.1' && host !== '[::1]'
}

export function cloudOrigin(): string {
  return ''
}

function readToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

/**
 * Whether this browser has a cloud session, as last observed.
 *
 * Localhost is allowed to run with no session at all (the code only buys cloud
 * sync), but nothing used to tell the save path that. Every action therefore fired a
 * doomed `PUT /api/vault`, got 401, and told the user "Sesi cloud habis" — on a
 * browser that never had a session to begin with. The flag starts "unknown" so a
 * public host, where the gate guarantees a session, still tries.
 */
let sessionKnown = false
let sessionOn = false

function noteSession(on: boolean): void {
  sessionKnown = true
  sessionOn = on
}

/**
 * Drop the stored bearer token without touching the session verdict.
 *
 * The token and the session are not the same thing: the worker accepts either a
 * bearer token or the session cookie, so a token that stopped working says nothing
 * about the cookie. `clearCloudToken` is for when both are gone.
 */
function forgetToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* private mode */
  }
}

/** True while we have no reason to believe the cloud will reject the write. */
export function cloudSyncPossible(): boolean {
  return !sessionKnown || sessionOn
}

/** Exported for tests: whether this browser holds a cloud session token at all. */
export function readCloudToken(): string | null {
  return readToken()
}

export function saveCloudToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token)
  noteSession(true)
}

export function clearCloudToken(): void {
  window.localStorage.removeItem(TOKEN_KEY)
  noteSession(false)
}

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const token = readToken()
  const headers = new Headers(init.headers)
  const method = (init.method || 'GET').toUpperCase()
  const hasBody = init.body != null && method !== 'GET' && method !== 'HEAD'
  if (hasBody && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(`${cloudOrigin()}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  })
}

export type SessionState = {
  signedIn: boolean
  email?: string
  configured: boolean
  /**
   * Localhost only: the vault is already in this browser's IndexedDB, so the app
   * can run without a cloud session. Syncing waits until the OTP goes through.
   */
  localOnly?: boolean
  error?: 'network' | 'missing'
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

const PING_PATHS = ['/api/ping', '/kunci-status'] as const
const SESSION_PATHS = ['/api/me', '/api/session'] as const

function jsonContent(res: Response): boolean {
  return (res.headers.get('content-type') || '').toLowerCase().includes('application/json')
}

function apiAlive(res: Response): boolean {
  if (!jsonContent(res)) return false
  return res.status < 502
}

async function tryGet(fetchFn: FetchLike, url: string, init: RequestInit): Promise<Response | null> {
  try {
    return await fetchFn(url, { method: 'GET', cache: 'no-store', ...init })
  } catch {
    return null
  }
}

export async function probeCloudSession(opts: {
  fetch: FetchLike
  publicHost: boolean
  token: string | null
  cloudUrl?: string
  /** Localhost only: a decrypted-able vault already exists in IndexedDB. */
  localVault?: boolean
  /** The user asked for the code screen, so skip the localOnly shortcut. */
  requireGate?: boolean
}): Promise<SessionState> {
  const cloud = (opts.cloudUrl || DEFAULT_CLOUD_URL).replace(/\/$/, '')
  const origins = opts.publicHost ? [''] : ['', cloud]
  let network = false

  for (const origin of origins) {
    const cookies = origin === ''
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`
    let contacted = false
    let email: string | undefined

    for (const path of PING_PATHS) {
      const res = await tryGet(opts.fetch, `${origin}${path}`, {
        credentials: 'omit',
        headers: { Accept: 'application/json' },
      })
      if (!res) {
        network = true
        continue
      }
      if (apiAlive(res)) {
        contacted = true
        break
      }
    }

    for (const path of SESSION_PATHS) {
      let res = await tryGet(opts.fetch, `${origin}${path}`, {
        credentials: cookies ? 'include' : 'omit',
        headers,
      })
      if (!res && cookies) {
        network = true
        res = await tryGet(opts.fetch, `${origin}${path}`, {
          credentials: 'omit',
          headers,
        })
      } else if (!res) {
        network = true
      }
      // A stale Authorization header shadows a live cookie: the worker reads
      // `bearer || cookie`, so a 401 with the header says nothing about the cookie.
      // Ask again without it before concluding this browser is signed out —
      // otherwise a token signed with a rotated secret parked the app at the code
      // screen and blocked every save for the rest of the page's life.
      if (res && res.status === 401 && headers.Authorization) {
        delete headers.Authorization
        res = await tryGet(opts.fetch, `${origin}${path}`, {
          credentials: cookies ? 'include' : 'omit',
          headers,
        })
        // The cookie answered where the header could not, so the header is the dead
        // one. Dropping it here means the save path does not have to rediscover this
        // on every action.
        if (res && res.ok) forgetToken()
      }
      if (!res) continue
      if (!apiAlive(res)) continue
      contacted = true
      if (res.ok) {
        const body = (await res.json().catch(() => ({}))) as { email?: string }
        if (body.email) {
          email = body.email
          break
        }
      }
      break
    }

    if (email) {
      noteSession(true)
      return { signedIn: true, email, configured: true }
    }
    if (contacted) {
      // A vault on this machine is enough for localhost: the code only buys
      // cloud sync, and blocking on it locked people out of their own data
      // whenever the mail key was missing.
      if (opts.localVault && !opts.publicHost && !opts.requireGate) {
        noteSession(false)
        return { signedIn: false, configured: true, localOnly: true }
      }
      noteSession(false)
      return { signedIn: false, configured: true }
    }
  }

  // No reply from the API at all. This is the one case that must NOT record a
  // verdict: a momentary network drop during boot used to set sessionOn=false, and
  // cloudSyncPossible() then refused every later save for the rest of the page's
  // life — a transient failure became a permanent "never sync again" switch.
  return { signedIn: false, configured: false, error: network ? 'network' : 'missing' }
}

export async function sessionStatus(): Promise<SessionState> {
  // A vault in IndexedDB means localhost does not need a cloud session to open it.
  const localVault = await hasLocalVault()
  return probeCloudSession({
    fetch: (input, init) => globalThis.fetch(input, init),
    publicHost: isPublicHost(),
    token: readToken(),
    localVault,
    // The user explicitly asked for the code screen, so do not skip it.
    requireGate: takeGateRequest(),
  })
}

/**
 * Whether this browser can write to the cloud right now. Settings uses it to say
 * plainly that changes stay on the device until the email gate is passed.
 */
export async function cloudHasSession(): Promise<boolean> {
  const state = await sessionStatus()
  return state.signedIn
}

function parseApiError(text: string, status: number, fallback: string): string {
  try {
    const body = JSON.parse(text) as { error?: string }
    if (body.error) return body.error
  } catch {
    /* not json */
  }
  if (status === 404) return 'API cloud tidak ditemukan. Tunggu deploy selesai, lalu coba lagi.'
  if (status === 429) return 'Terlalu banyak permintaan. Coba beberapa menit lagi.'
  return `${fallback} (HTTP ${status})`
}

export async function requestOtp(): Promise<void> {
  const res = await api('/api/auth/otp', { method: 'POST', body: JSON.stringify({ email: RECOVERY_EMAIL }) })
  const text = await res.text()
  if (!res.ok) throw new Error(parseApiError(text, res.status, 'Gagal mengirim kode masuk'))
}

export async function verifyOtp(code: string): Promise<void> {
  const res = await api('/api/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ email: RECOVERY_EMAIL, code: code.trim() }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(parseApiError(text, res.status, 'Kode salah'))
  const body = (() => {
    try {
      return JSON.parse(text) as { token?: string }
    } catch {
      return {} as { token?: string }
    }
  })()
  if (body.token) saveCloudToken(body.token)
}

export async function logoutSession(): Promise<void> {
  await api('/api/auth/logout', { method: 'POST', body: '{}' }).catch(() => undefined)
  clearCloudToken()
}

export async function cloudGetVault(): Promise<EncryptedBlob | null> {
  try {
    let res = await api('/api/vault')
    // Same shadowing as cloudPutVault: a stale bearer hides a live cookie, and a
    // 401 here reads as "no cloud copy" — which then let a local copy overwrite the
    // cloud one. Ask once without the header before believing the vault is absent.
    if (res.status === 401 && readToken()) {
      forgetToken()
      res = await api('/api/vault')
    }
    if (res.status === 401 || res.status === 404) return null
    if (!res.ok) return null
    const body = (await res.json()) as { blob?: unknown }
    if (!isEncryptedBlob(body.blob)) return null
    return body.blob
  } catch {
    return null
  }
}

export async function cloudPutVault(blob: EncryptedBlob): Promise<void> {
  // Nothing to sync to. Localhost runs fine without a session; firing the request
  // anyway produced a 401 on every single save and warned "Sesi cloud habis" each
  // time, which reads as a broken session rather than "this browser never signed in".
  if (!cloudSyncPossible()) return
  const body = JSON.stringify({ blob })
  let res = await api('/api/vault', { method: 'PUT', body })
  if (res.status === 401 && readToken()) {
    // The worker picks its credential with `bearer || cookie` (worker/index.ts,
    // sessionEmail), so a leftover Authorization header shadows a session cookie
    // that is still perfectly good. The header can outlive its usefulness: it is
    // signed with a secret that may have been rotated, and it is the copy that
    // expires at 12 hours. Retrying without it lets the cookie answer, and dropping
    // it means the next save does not repeat the mistake.
    forgetToken()
    res = await api('/api/vault', { method: 'PUT', body })
  }
  if (res.status === 401) {
    // Both credentials are dead, so there is nothing left to retry with. Recording
    // the verdict stops the rest of this page's saves from firing the same doomed
    // request; the next launch asks for the code once.
    noteSession(false)
    throw new Error('Sesi cloud habis. Buka Pengaturan → Sesi untuk masuk lagi dengan kode email.')
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || 'Gagal sinkron ke cloud')
  }
}

export async function emailRecoveryKey(recoveryKey: string): Promise<boolean> {
  const res = await api('/api/mail/recovery', {
    method: 'POST',
    body: JSON.stringify({ recoveryKey }),
  })
  return res.ok
}
