import { useState, type FormEvent } from 'react'
import { Field, TextInput } from './Field'
import { IconLock } from './Icons'
import { RECOVERY_EMAIL } from '../lib/account'
import { requestOtp, verifyOtp } from '../lib/cloud'

export function AuthGate({ onAuthed }: { onAuthed: () => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

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
            <h1>Kunci — gerbang publik</h1>
            <p>Hanya {RECOVERY_EMAIL} yang boleh membuka situs ini.</p>
          </div>
        </div>
        <p className="lede">
          Cek address bar: harus HTTPS dan domain Kunci milikmu. Kode 8 karakter hanya membuka sesi — server tetap tidak
          bisa membaca password. Kata sandi induk dimasukkan setelah ini, di perangkat ini.
        </p>
        <p className="hint-pill">Situs: {window.location.host}</p>
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
  return (
    <div className="gate">
      <div className="gate-card">
        <div className="brand">
          <span className="brand-mark">
            <IconLock size={28} />
          </span>
          <div>
            <h1>API Kunci belum siap</h1>
            <p>Situs publik butuh fungsi Netlify + variabel lingkungan.</p>
          </div>
        </div>
        <p className="lede">
          Di Netlify: Base directory <code>kunci</code>, lalu set <code>KUNCI_SESSION_SECRET</code> (min. 16 karakter acak)
          dan <code>RESEND_API_KEY</code>. Redeploy setelah itu.
        </p>
      </div>
    </div>
  )
}
