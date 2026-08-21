import { useState, type FormEvent } from 'react'
import { Field, SecretInput, StrengthBar, TextInput } from '../components/Field'
import { IconKey, IconLock } from '../components/Icons'
import { isStrongMaster, passwordStrength } from '../lib/strength'
import { useVault } from '../state/VaultContext'

export function SetupScreen() {
  const { setup, busy, recoveryEmail } = useVault()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [hint, setHint] = useState('')
  const [error, setError] = useState('')
  const strength = passwordStrength(password)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Konfirmasi tidak sama')
      return
    }
    if (!isStrongMaster(password)) {
      setError('Kata sandi induk minimal 12 karakter dan harus kuat')
      return
    }
    await setup(password, hint.trim())
  }

  return (
    <div className="gate">
      <div className="gate-card">
        <div className="brand">
          <span className="brand-mark">
            <IconKey size={28} />
          </span>
          <div>
            <h1>Kunci</h1>
            <p>Brankas kata sandi lokal untuk Mac</p>
          </div>
        </div>
        <form className="stack" onSubmit={(e) => void onSubmit(e)}>
          <p className="lede">
            Data dienkripsi di Mac ini. Kalau lupa kata sandi, reset dikirim ke <strong>{recoveryEmail}</strong> — layanan
            24 jam harus aktif (<code>npm run install-service</code>).
          </p>
          <Field label="Kata sandi induk">
            <SecretInput value={password} onChange={setPassword} autoComplete="new-password" placeholder="Minimal 12 karakter" />
          </Field>
          <StrengthBar score={strength.score} label={strength.label} />
          {strength.reasons[0] ? <p className="muted">{strength.reasons[0]}</p> : null}
          <Field label="Konfirmasi">
            <SecretInput value={confirm} onChange={setConfirm} autoComplete="new-password" />
          </Field>
          <Field label="Petunjuk (opsional, tidak dienkripsi)" hint="Jangan tulis kata sandinya sendiri.">
            <TextInput value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Mis. pola keyboard yang kamu pakai" />
          </Field>
          {error ? <p className="error">{error}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Menyiapkan…' : 'Buat brankas'}
          </button>
        </form>
      </div>
    </div>
  )
}

export function LockScreen() {
  const { unlock, hint, busy, requestPasswordReset, confirmPasswordReset, recoveryEmail } = useVault()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'unlock' | 'reset'>('unlock')
  const [code, setCode] = useState('')
  const [next, setNext] = useState('')
  const [next2, setNext2] = useState('')
  const [sent, setSent] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await unlock(password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuka')
    }
  }

  async function onSendCode() {
    setError('')
    try {
      await requestPasswordReset()
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal kirim kode')
    }
  }

  async function onReset(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (next !== next2) {
      setError('Konfirmasi tidak sama')
      return
    }
    if (!isStrongMaster(next)) {
      setError('Kata sandi baru kurang kuat (min. 12 karakter)')
      return
    }
    try {
      await confirmPasswordReset(code, next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal reset')
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
            <h1>{mode === 'unlock' ? 'Kunci terkunci' : 'Reset kata sandi'}</h1>
            <p>
              {mode === 'unlock'
                ? 'Masukkan kata sandi induk untuk membuka brankas'
                : `Kode dikirim ke ${recoveryEmail}`}
            </p>
          </div>
        </div>
        {mode === 'unlock' ? (
          <form className="stack" onSubmit={(e) => void onSubmit(e)}>
            <Field label="Kata sandi induk">
              <SecretInput value={password} onChange={setPassword} autoComplete="current-password" />
            </Field>
            {hint ? <p className="hint-pill">Petunjuk: {hint}</p> : null}
            {error ? <p className="error">{error}</p> : null}
            <button className="btn btn-primary" type="submit" disabled={busy || !password}>
              {busy ? 'Membuka…' : 'Buka brankas'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setMode('reset')}>
              Lupa kata sandi?
            </button>
          </form>
        ) : (
          <form className="stack" onSubmit={(e) => void onReset(e)}>
            <p className="lede">Kode 6 digit dikirim ke Mail.app / Gmail kamu. Layanan 24 jam harus aktif.</p>
            <button type="button" className="btn" onClick={() => void onSendCode()} disabled={busy}>
              {sent ? 'Kirim ulang kode' : `Kirim kode ke ${recoveryEmail}`}
            </button>
            <Field label="Kode dari email">
              <TextInput value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" />
            </Field>
            <Field label="Kata sandi baru">
              <SecretInput value={next} onChange={setNext} autoComplete="new-password" />
            </Field>
            <Field label="Konfirmasi baru">
              <SecretInput value={next2} onChange={setNext2} autoComplete="new-password" />
            </Field>
            {error ? <p className="error">{error}</p> : null}
            <button className="btn btn-primary" type="submit" disabled={busy || !code || !next}>
              {busy ? 'Mengganti…' : 'Ganti kata sandi'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setMode('unlock')}>
              Kembali
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
