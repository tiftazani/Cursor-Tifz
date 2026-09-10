import { useEffect, useState, type FormEvent } from 'react'
import { Field, TextInput } from './Field'
import { IconLock } from './Icons'
import { IosInstallCard } from './IosInstallCard'
import { RECOVERY_EMAIL } from '../lib/account'
import { DEFAULT_CLOUD_URL } from '../lib/allowed-origins'
import { isPublicHost, requestOtp, verifyOtp } from '../lib/cloud'
import { OTP_SENT_AT_KEY, otpSendCooldownRemaining } from '../lib/otp-policy'

function readOtpSentAt(): number | null {
  try {
    const raw = sessionStorage.getItem(OTP_SENT_AT_KEY)
    const n = raw ? Number(raw) : NaN
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

function rememberOtpSentAt(sentAt: number): void {
  try {
    sessionStorage.setItem(OTP_SENT_AT_KEY, String(sentAt))
  } catch {
    /* private mode */
  }
}

export function AuthGate({ onAuthed }: { onAuthed: () => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sentAt, setSentAt] = useState<number | null>(() => readOtpSentAt())
  const [now, setNow] = useState(() => Date.now())
  const local = !isPublicHost()
  const cooling = otpSendCooldownRemaining(sentAt, now) > 0

  useEffect(() => {
    if (!cooling) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [cooling])

  async function send() {
    if (busy || otpSendCooldownRemaining(sentAt, Date.now()) > 0) return
    setError('')
    setBusy(true)
    try {
      await requestOtp()
      const t = Date.now()
      setSentAt(t)
      setNow(t)
      rememberOtpSentAt(t)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal kirim kode')
    } finally {
      setBusy(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await verifyOtp(code)
      onAuthed()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kode salah')
      setBusy(false)
    }
  }

  return (
    <div className="gate">
      <div className="gate-card">
        <div className="brand">
          <span className="brand-mark">
            <IconLock size={28} />
          </span>
          <div>
            <h1>Kunci — satu brankas</h1>
            <p>Hanya {RECOVERY_EMAIL} yang boleh membuka sesi cloud.</p>
          </div>
        </div>
        <p className="lede">
          {local
            ? `Localhost dan ${DEFAULT_CLOUD_URL} memakai ciphertext yang sama. Kode 8 karakter membuka sesi sinkron — server tetap tidak bisa membaca password. Site Netlify harus Public (bukan Private / Team login), kalau tidak helper tidak bisa kirim kode.`
            : 'Cek address bar: harus HTTPS dan domain Kunci milikmu. Kode 8 karakter hanya membuka sesi. Kata sandi induk dimasukkan setelah ini.'}
        </p>
        <p className="hint-pill">Situs ini: {window.location.host}</p>
        <IosInstallCard />
        <form className="stack" onSubmit={(e) => void onSubmit(e)}>
          <button type="button" className="btn" onClick={() => void send()} disabled={busy || cooling}>
            {cooling
              ? 'Kode sudah dikirim — cek Gmail'
              : sentAt
                ? 'Kirim ulang kode'
                : 'Kirim kode masuk ke Gmail'}
          </button>
          <Field label="Kode dari email">
            <TextInput
              className="otp-input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              autoComplete="one-time-code"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore="true"
              data-bwignore="true"
              data-form-type="other"
            />
          </Field>
          {error ? <p className="error">{error}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={busy || code.trim().length < 6}>
            {busy ? 'Memeriksa…' : 'Lanjut'}
          </button>
        </form>
      </div>
    </div>
  )
}

export function ApiMissingScreen({ reason }: { reason?: 'network' | 'missing' }) {
  const local = typeof window !== 'undefined' && !isPublicHost()
  const offline = reason === 'network'
  const title = offline
    ? 'Tidak bisa hubungi server Kunci'
    : local
      ? 'Cloud Kunci belum terjangkau'
      : 'API Kunci belum siap'
  const subtitle = offline
    ? 'Jaringan terputus, Safari menolak cek sesi, atau pemblokir iklan menahan API.'
    : local
      ? `Localhost harus bisa menghubungi ${DEFAULT_CLOUD_URL}.`
      : 'Situs publik butuh fungsi Netlify + variabel lingkungan.'
  const lede = offline
    ? `Matikan pemblokir iklan untuk ${typeof window !== 'undefined' ? window.location.host : 'situs ini'}, cek Wi-Fi, lalu coba lagi. Kalau masih gagal: di Netlify Base directory kunci, set KUNCI_SESSION_SECRET dan RESEND_API_KEY, lalu redeploy.`
    : local
      ? `Pastikan ${DEFAULT_CLOUD_URL} Public di Netlify (Project visibility), lalu nyalakan helper: npm run install-service.`
      : 'Di Netlify: Base directory kunci, lalu set KUNCI_SESSION_SECRET (min. 16 karakter acak) dan RESEND_API_KEY. Redeploy setelah itu.'
  return (
    <div className="gate">
      <div className="gate-card">
        <div className="brand">
          <span className="brand-mark">
            <IconLock size={28} />
          </span>
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
        </div>
        <p className="lede">{lede}</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Coba lagi
        </button>
      </div>
    </div>
  )
}
