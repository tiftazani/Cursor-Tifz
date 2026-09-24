/**
 * Kunci cloud API on Cloudflare Workers.
 * Mirrors the Netlify function it replaces: same routes, same session cookie,
 * same encrypted-blob-only storage. The server never sees a plaintext password.
 */
import { isAllowedKunciOrigin } from '../src/lib/allowed-origins'
import { isPingPath, isSessionPath, normalizeApiPath } from '../src/lib/api-path'
import { OTP_MAX_ATTEMPTS, OTP_TTL_MS, shouldReuseOtp, type StoredOtp } from '../src/lib/otp-policy'

const ALLOWED_EMAIL = 'tiftazani.khara@gmail.com'
const COOKIE = 'kunci_session'
const MAX_VAULT_BYTES = 1_500_000
const SESSION_MS = 12 * 60 * 60 * 1000

export interface Env {
  KUNCI: DurableObjectNamespace
  KUNCI_SESSION_SECRET?: string
  RESEND_API_KEY?: string
  KUNCI_FROM_EMAIL?: string
}

/**
 * Single-user store. A Durable Object is strongly consistent, so the OTP attempt
 * cap and the rate-limit counters cannot be bypassed by reading a stale replica.
 */
export class KunciStore {
  private state: DurableObjectState
  constructor(state: DurableObjectState) {
    this.state = state
  }

  async fetch(req: Request): Promise<Response> {
    const { op, key, value, max, windowMs } = (await req.json()) as {
      op: 'get' | 'set' | 'rate'
      key: string
      value?: unknown
      max?: number
      windowMs?: number
    }
    if (op === 'get') {
      // storage.get() returns undefined for a missing key; JSON has no undefined,
      // so normalize to null or the client's .json() blows up parsing "undefined".
      return Response.json((await this.state.storage.get(key)) ?? null)
    }
    if (op === 'set') {
      if (value === null) await this.state.storage.delete(key)
      else await this.state.storage.put(key, value)
      return Response.json({ ok: true })
    }
    // rate: fixed window counter
    const now = Date.now()
    const rl = ((await this.state.storage.get(key)) as { n?: number; t?: number } | null) ?? {}
    const n = (rl.t && rl.t > now - (windowMs ?? 0) ? rl.n ?? 0 : 0) + 1
    await this.state.storage.put(key, { n, t: now })
    return Response.json({ ok: n <= (max ?? 0) })
  }
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin')
  if (!origin || !originAllowed(req)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  })
}

function originAllowed(req: Request): boolean {
  const origin = req.headers.get('origin')
  const ua = req.headers.get('user-agent') || ''
  if (ua.startsWith('Kunci-local/')) return true
  if (!origin) return req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS'
  return isAllowedKunciOrigin(origin, req.headers.get('host') || '')
}

function clientIp(req: Request): string {
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

function secret(env: Env): string {
  const s = env.KUNCI_SESSION_SECRET || ''
  if (s.length < 16) throw new Error('KUNCI_SESSION_SECRET belum di-set (min. 16 karakter acak)')
  return s
}

async function hmac(payload: string, key: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(payload))
  return btoa(String.fromCharCode(...new Uint8Array(mac))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Constant-time compare over equal-length strings. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function readCookie(req: Request, name: string): string | null {
  for (const part of (req.headers.get('cookie') || '').split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

async function sessionEmail(req: Request, env: Env): Promise<string | null> {
  const auth = req.headers.get('authorization')
  const bearer = auth?.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : null
  const raw = bearer || readCookie(req, COOKIE)
  if (!raw) return null
  const bits = raw.split('|')
  if (bits.length !== 3) return null
  const [email, exp, mac] = bits
  if (!email || !exp || !mac) return null
  if (!safeEqual(mac, await hmac(`${email}|${exp}`, secret(env)))) return null
  if (Date.now() > Number(exp)) return null
  if (email.toLowerCase() !== ALLOWED_EMAIL) return null
  return email
}

async function issueSession(email: string, req: Request, env: Env): Promise<{ token: string; cookie: string }> {
  const exp = Date.now() + SESSION_MS
  const token = `${email}|${exp}|${await hmac(`${email}|${exp}`, secret(env))}`
  const parts = [
    `${COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.floor(SESSION_MS / 1000)}`,
  ]
  if (new URL(req.url).protocol === 'https:') parts.push('Secure')
  return { token, cookie: parts.join('; ') }
}

async function sendEmail(env: Env, subject: string, text: string): Promise<void> {
  if (!env.RESEND_API_KEY) {
    throw new Error(
      'OTP email belum aktif di server ini: secret RESEND_API_KEY kosong. ' +
        'Ambil key di resend.com/api-keys, lalu jalankan: ' +
        "printf '%s' \"re_xxx\" | npx wrangler secret put RESEND_API_KEY",
    )
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.KUNCI_FROM_EMAIL || 'Kunci <onboarding@resend.dev>',
      to: [ALLOWED_EMAIL],
      subject,
      text,
    }),
  })
  if (!res.ok) throw new Error(`Gagal kirim email (${res.status})`)
}

function looksLikeBlob(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const v = value as { v?: number; kdf?: string; salt?: string; data?: string; iter?: number; iv?: string }
  return (
    (v.v === 1 || v.v === 2) &&
    v.kdf === 'PBKDF2-SHA256' &&
    typeof v.salt === 'string' &&
    typeof v.data === 'string' &&
    typeof v.iv === 'string' &&
    typeof v.iter === 'number'
  )
}

function sanitizeBlob(value: unknown): Record<string, unknown> | null {
  if (!looksLikeBlob(value) || !value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  for (const k of ['dek', 'password', 'recoveryKey', 'key', 'plaintext']) {
    if (k in v) return null
  }
  const out: Record<string, unknown> = {
    v: v.v,
    kdf: v.kdf,
    iter: v.iter,
    salt: v.salt,
    iv: v.iv,
    data: v.data,
  }
  for (const k of ['wrapIv', 'wrap', 'recSalt', 'recWrapIv', 'recWrap']) {
    if (typeof v[k] === 'string') out[k] = v[k]
  }
  if (typeof v.savedAt === 'number') out.savedAt = v.savedAt
  return out
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const respond = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
      json(body, status, { ...corsHeaders(req), ...extraHeaders })

    // One Durable Object holds every secret; the app is single-user.
    const store = env.KUNCI.get(env.KUNCI.idFromName('kunci'))
    const storeFetch = (payload: Record<string, unknown>) =>
      store.fetch('https://store/', { method: 'POST', body: JSON.stringify(payload) })
    const getKey = async <T>(key: string): Promise<T | null> => (await (await storeFetch({ op: 'get', key })).json()) as T | null
    const setKey = async (key: string, value: unknown) => {
      await storeFetch({ op: 'set', key, value })
    }
    const rateOk = async (key: string, max: number, windowMs: number) =>
      ((await (await storeFetch({ op: 'rate', key, max, windowMs })).json()) as { ok: boolean }).ok

    if (req.method === 'OPTIONS') {
      if (req.headers.get('origin') && !originAllowed(req)) return respond({ error: 'Origin ditolak' }, 403)
      return new Response(null, { status: 204, headers: corsHeaders(req) })
    }

    if (req.method !== 'GET' && req.method !== 'HEAD' && !originAllowed(req)) {
      return respond({ error: 'Origin ditolak' }, 403)
    }

    const url = new URL(req.url)
    const path = normalizeApiPath(url.pathname)

    try {
      if ((req.method === 'GET' || req.method === 'HEAD') && isPingPath(path)) {
        return respond({ ok: true })
      }

      if (req.method === 'GET' && isSessionPath(path)) {
        const email = await sessionEmail(req, env)
        if (!email) return respond({ ok: false }, 401)
        return respond({ ok: true, email })
      }

      if (req.method === 'POST' && path === '/api/auth/logout') {
        return respond({ ok: true }, 200, {
          'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
        })
      }

      if (req.method === 'POST' && path === '/api/auth/otp') {
        const existing = await getKey<StoredOtp>('otp')
        if (shouldReuseOtp(existing, Date.now())) {
          return respond({ ok: true, email: ALLOWED_EMAIL })
        }
        if (!(await rateOk(`rl:otp:${clientIp(req)}`, 20, 60 * 60 * 1000))) {
          return respond({ error: 'Terlalu banyak permintaan. Coba 1 jam lagi.' }, 429)
        }
        const code = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()
        const salt = crypto.randomUUID().replace(/-/g, '')
        const now = Date.now()
        // Send first, store after. Storing first left a reusable OTP record behind
        // when the email failed, so the next request answered ok:true and the user
        // waited for a code that was never sent.
        await sendEmail(env, 'Kode masuk Kunci', `Kode masuk Kunci: ${code}\nBerlaku 10 menit.\nKalau bukan kamu, abaikan.\n`)
        await setKey('otp', {
          hash: await sha256Hex(`${salt}:${code}`),
          salt,
          exp: now + OTP_TTL_MS,
          issuedAt: now,
          attempts: 0,
        })
        return respond({ ok: true, email: ALLOWED_EMAIL })
      }

      if (req.method === 'POST' && path === '/api/auth/verify') {
        if (!(await rateOk(`rl:verify:${clientIp(req)}`, 20, 60 * 60 * 1000))) {
          return respond({ error: 'Terlalu banyak percobaan. Coba 1 jam lagi.' }, 429)
        }
        const body = (await req.json().catch(() => ({}))) as { code?: string; email?: string }
        if ((body.email || ALLOWED_EMAIL).toLowerCase() !== ALLOWED_EMAIL) {
          return respond({ error: 'Email tidak diizinkan' }, 403)
        }
        const otp = await getKey<StoredOtp>('otp')
        if (!otp) return respond({ error: 'Tidak ada kode aktif' }, 400)
        if (Date.now() > otp.exp) return respond({ error: 'Kode kedaluwarsa' }, 400)
        if (otp.attempts >= OTP_MAX_ATTEMPTS) return respond({ error: 'Terlalu banyak percobaan' }, 429)
        const incoming = await sha256Hex(`${otp.salt}:${String(body.code || '').trim().toUpperCase()}`)
        const ok = safeEqual(incoming, otp.hash)
        await setKey('otp', { ...otp, attempts: otp.attempts + 1 })
        if (!ok) return respond({ error: 'Kode salah' }, 401)
        await setKey('otp', { ...otp, attempts: otp.attempts + 1, exp: 0 })
        const session = await issueSession(ALLOWED_EMAIL, req, env)
        return respond({ ok: true, email: ALLOWED_EMAIL, token: session.token }, 200, { 'Set-Cookie': session.cookie })
      }

      if (req.method === 'POST' && path === '/api/mail/recovery') {
        if (!(await sessionEmail(req, env))) return respond({ error: 'Sesi tidak valid' }, 401)
        if (!(await rateOk(`rl:mail:${clientIp(req)}`, 4, 60 * 60 * 1000))) {
          return respond({ error: 'Terlalu banyak email. Coba 1 jam lagi.' }, 429)
        }
        const body = (await req.json().catch(() => ({}))) as { recoveryKey?: string }
        const key = (body.recoveryKey || '').trim()
        if (key.length < 16 || key.length > 80) return respond({ error: 'Recovery key tidak valid' }, 400)
        await sendEmail(
          env,
          'Recovery key Kunci — simpan aman',
          `Recovery key Kunci kamu:\n\n${key}\n\nIni satu-satunya cara mereset kata sandi induk tanpa kehilangan data. Server Kunci tidak menyimpan kunci ini secara permanen.\n`,
        )
        return respond({ ok: true })
      }

      if (path === '/api/vault') {
        if (!(await sessionEmail(req, env))) return respond({ error: 'Sesi tidak valid' }, 401)
        if (req.method === 'GET') {
          return respond({ blob: (await getKey('vault')) ?? null })
        }
        if (req.method === 'PUT') {
          const body = (await req.json().catch(() => ({}))) as { blob?: unknown }
          const clean = sanitizeBlob(body.blob)
          if (!clean) return respond({ error: 'Format brankas ditolak' }, 400)
          if (JSON.stringify(clean).length > MAX_VAULT_BYTES) return respond({ error: 'Brankas terlalu besar' }, 413)
          await setKey('vault', clean)
          return respond({ ok: true })
        }
      }

      return respond({ error: 'not found' }, 404)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Server error'
      return respond({ error: message }, 500)
    }
  },
}
