import { getStore } from '@netlify/blobs'
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const ALLOWED_EMAIL = 'tiftazani.khara@gmail.com'
const COOKIE = 'kunci_session'
const MAX_VAULT_BYTES = 1_500_000
const SESSION_MS = 12 * 60 * 60 * 1000

function env(name: string): string {
  try {
    const n = (globalThis as { Netlify?: { env?: { get: (k: string) => string | undefined } } }).Netlify?.env?.get(name)
    if (n) return n
  } catch {
    /* ignore */
  }
  return process.env[name] ?? ''
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

function clientIp(req: Request): string {
  return req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

function originAllowed(req: Request): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return req.method === 'GET' || req.method === 'HEAD'
  try {
    const host = req.headers.get('host') || ''
    const o = new URL(origin)
    return o.host === host
  } catch {
    return false
  }
}

function secret(): string {
  const s = env('KUNCI_SESSION_SECRET')
  if (!s || s.length < 16) throw new Error('KUNCI_SESSION_SECRET belum di-set (min. 16 karakter acak)')
  return s
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

function sessionCookie(email: string, req: Request): string {
  const exp = Date.now() + SESSION_MS
  const payload = `${email}|${exp}`
  const value = `${payload}|${sign(payload)}`
  const secure = new URL(req.url).protocol === 'https:'
  const parts = [
    `${COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.floor(SESSION_MS / 1000)}`,
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

function clearCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
}

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get('cookie') || ''
  for (const part of raw.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

function sessionEmail(req: Request): string | null {
  const raw = readCookie(req, COOKIE)
  if (!raw) return null
  const bits = raw.split('|')
  if (bits.length !== 3) return null
  const [email, exp, mac] = bits
  if (!email || !exp || !mac) return null
  const expect = sign(`${email}|${exp}`)
  const a = Buffer.from(mac)
  const b = Buffer.from(expect)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  if (Date.now() > Number(exp)) return null
  if (email.toLowerCase() !== ALLOWED_EMAIL) return null
  return email
}

function hashOtp(code: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${code}`).digest('hex')
}

async function store() {
  return getStore({ name: 'kunci-secure', consistency: 'strong' })
}

async function bumpRateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const blobs = await store()
  const rl = ((await blobs.get(key, { type: 'json' })) as { n?: number; t?: number } | null) ?? {}
  const windowStart = Date.now() - windowMs
  const n = (rl.t && rl.t > windowStart ? rl.n ?? 0 : 0) + 1
  await blobs.setJSON(key, { n, t: Date.now() })
  return n <= max
}

async function sendEmail(subject: string, text: string): Promise<void> {
  const key = env('RESEND_API_KEY')
  if (!key) {
    throw new Error('RESEND_API_KEY belum di-set di Netlify. Tanpa itu kode OTP tidak bisa dikirim.')
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env('KUNCI_FROM_EMAIL') || 'Kunci <onboarding@resend.dev>',
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
  const forbidden = ['dek', 'password', 'recoveryKey', 'key', 'plaintext']
  for (const k of forbidden) {
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
  if (typeof v.wrapIv === 'string') out.wrapIv = v.wrapIv
  if (typeof v.wrap === 'string') out.wrap = v.wrap
  if (typeof v.recSalt === 'string') out.recSalt = v.recSalt
  if (typeof v.recWrapIv === 'string') out.recWrapIv = v.recWrapIv
  if (typeof v.recWrap === 'string') out.recWrap = v.recWrap
  if (typeof v.savedAt === 'number') out.savedAt = v.savedAt
  return out
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'GET' && req.method !== 'HEAD' && !originAllowed(req)) {
    return json({ error: 'Origin ditolak' }, 403)
  }
  const url = new URL(req.url)
  const path = url.pathname

  try {
    if (req.method === 'GET' && path === '/api/session') {
      const email = sessionEmail(req)
      if (!email) return json({ ok: false }, 401)
      return json({ ok: true, email })
    }

    if (req.method === 'POST' && path === '/api/auth/logout') {
      return json({ ok: true }, 200, { 'Set-Cookie': clearCookie() })
    }

    if (req.method === 'POST' && path === '/api/auth/otp') {
      const ip = clientIp(req)
      if (!(await bumpRateLimit(`rl:otp:${ip}`, 8, 60 * 60 * 1000))) {
        return json({ error: 'Terlalu banyak permintaan. Coba 1 jam lagi.' }, 429)
      }

      const blobs = await store()
      const code = randomBytes(5).toString('hex').slice(0, 8).toUpperCase()
      const salt = randomBytes(16).toString('hex')
      await blobs.setJSON('otp', {
        hash: hashOtp(code, salt),
        salt,
        exp: Date.now() + 10 * 60 * 1000,
        attempts: 0,
      })
      await sendEmail('Kode masuk Kunci', `Kode masuk Kunci: ${code}\nBerlaku 10 menit.\nKalau bukan kamu, abaikan.\n`)
      return json({ ok: true, email: ALLOWED_EMAIL })
    }

    if (req.method === 'POST' && path === '/api/auth/verify') {
      const ip = clientIp(req)
      if (!(await bumpRateLimit(`rl:verify:${ip}`, 20, 60 * 60 * 1000))) {
        return json({ error: 'Terlalu banyak percobaan. Coba 1 jam lagi.' }, 429)
      }
      const body = (await req.json().catch(() => ({}))) as { code?: string; email?: string }
      if ((body.email || ALLOWED_EMAIL).toLowerCase() !== ALLOWED_EMAIL) {
        return json({ error: 'Email tidak diizinkan' }, 403)
      }
      const blobs = await store()
      const otp = (await blobs.get('otp', { type: 'json' })) as
        | { hash: string; salt: string; exp: number; attempts: number }
        | null
      if (!otp) return json({ error: 'Tidak ada kode aktif' }, 400)
      if (Date.now() > otp.exp) return json({ error: 'Kode kedaluwarsa' }, 400)
      if (otp.attempts >= 5) return json({ error: 'Terlalu banyak percobaan' }, 429)
      const incoming = hashOtp(String(body.code || '').trim().toUpperCase(), otp.salt)
      const ok = incoming.length === otp.hash.length && timingSafeEqual(Buffer.from(incoming), Buffer.from(otp.hash))
      otp.attempts += 1
      await blobs.setJSON('otp', otp)
      if (!ok) return json({ error: 'Kode salah' }, 401)
      await blobs.setJSON('otp', { ...otp, exp: 0 })
      return json({ ok: true, email: ALLOWED_EMAIL }, 200, { 'Set-Cookie': sessionCookie(ALLOWED_EMAIL, req) })
    }

    if (req.method === 'POST' && path === '/api/mail/recovery') {
      if (!sessionEmail(req)) return json({ error: 'Sesi tidak valid' }, 401)
      const ip = clientIp(req)
      if (!(await bumpRateLimit(`rl:mail:${ip}`, 4, 60 * 60 * 1000))) {
        return json({ error: 'Terlalu banyak email. Coba 1 jam lagi.' }, 429)
      }
      const body = (await req.json().catch(() => ({}))) as { recoveryKey?: string }
      const key = (body.recoveryKey || '').trim()
      if (key.length < 16 || key.length > 80) return json({ error: 'Recovery key tidak valid' }, 400)
      await sendEmail(
        'Recovery key Kunci — simpan aman',
        `Recovery key Kunci kamu:\n\n${key}\n\nIni satu-satunya cara mereset kata sandi induk tanpa kehilangan data. Server Kunci tidak menyimpan kunci ini secara permanen.\n`,
      )
      return json({ ok: true })
    }

    if (path === '/api/vault') {
      const email = sessionEmail(req)
      if (!email) return json({ error: 'Sesi tidak valid' }, 401)
      const blobs = await store()
      if (req.method === 'GET') {
        const blob = await blobs.get('vault', { type: 'json' })
        return json({ blob: blob ?? null })
      }
      if (req.method === 'PUT') {
        const body = (await req.json().catch(() => ({}))) as { blob?: unknown }
        const clean = sanitizeBlob(body.blob)
        if (!clean) return json({ error: 'Format brankas ditolak' }, 400)
        const raw = JSON.stringify(clean)
        if (raw.length > MAX_VAULT_BYTES) return json({ error: 'Brankas terlalu besar' }, 413)
        await blobs.setJSON('vault', clean)
        return json({ ok: true })
      }
    }

    return json({ error: 'not found' }, 404)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    return json({ error: message }, 500)
  }
}

export const config = { path: ['/api/session', '/api/auth/*', '/api/vault', '/api/mail/recovery'] }
