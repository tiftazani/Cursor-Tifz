import { useState, type FormEvent } from 'react'
import { Field, TextInput } from './Field'
import { IconLock } from './Icons'
import { RECOVERY_EMAIL } from '../lib/account'
import { DEFAULT_CLOUD_URL } from '../lib/allowed-origins'
import { isPublicHost, requestOtp, verifyOtp } from '../lib/cloud'

export function AuthGate({ onAuthed }: { onAuthed: () => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const local = !isPublicHost()

  async function send() {
    setError('')
    setBusy(true)
    try {
      await requestOtp()
      setSent(true)
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
            ? `Localhost dan ${DEFAULT_CLOUD_URL} memakai ciphertext yang sama. Kode 8 karakter membuka sesi sinkron — server tetap tidak bisa membaca password.`
            : 'Cek address bar: harus HTTPS dan domain Kunci milikmu. Kode 8 karakter hanya membuka sesi. Kata sandi induk dimasukkan setelah ini.'}
        </p>
        <p className="hint-pill">Situs ini: {window.location.host}</p>
        <form className="stack" onSubmit={(e) => void onSubmit(e)}>
          <button type="button" className="btn" onClick={() => void send()} disabled={busy}>
            {sent ? 'Kirim ulang kode' : 'Kirim kode masuk ke Gmail'}
          </button>
          <Field label="Kode dari email">
            <TextInput
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              autoComplete="one-time-code"
              spellCheck={false}
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

export function ApiMissingScreen() {
  const local = typeof window !== 'undefined' && !isPublicHost()
  return (
    <div className="gate">
      <div className="gate-card">
        <div className="brand">
          <span className="brand-mark">
            <IconLock size={28} />
          </span>
          <div>
            <h1>{local ? 'Cloud Kunci belum terjangkau' : 'API Kunci belum siap'}</h1>
            <p>
              {local
                ? `Localhost harus bisa menghubungi ${DEFAULT_CLOUD_URL}.`
                : 'Situs publik butuh fungsi Netlify + variabel lingkungan.'}
            </p>
          </div>
        </div>
        <p className="lede">
          {local
            ? 'Pastikan site Netlify sudah live, lalu nyalakan helper: npm run start (biarkan Terminal terbuka) atau npm run install-service.'
            : 'Di Netlify: Base directory kunci, lalu set KUNCI_SESSION_SECRET (min. 16 karakter acak) dan RESEND_API_KEY. Redeploy setelah itu.'}
        </p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Coba lagi
        </button>
      </div>
    </div>
  )
}
