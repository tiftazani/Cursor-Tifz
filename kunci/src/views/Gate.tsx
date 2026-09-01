import { useState, type FormEvent } from 'react'
import { Field, SecretInput, StrengthBar, TextArea, TextInput } from '../components/Field'
import { IconKey, IconLock } from '../components/Icons'
import { IosInstallCard } from '../components/IosInstallCard'
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
            <p>Brankas kata sandi terenkripsi (zero-knowledge)</p>
          </div>
        </div>
        <form className="stack" autoComplete="off" onSubmit={(e) => void onSubmit(e)}>
          <p className="lede">
            Localhost dan URL publik memakai brankas terenkripsi yang sama. Server hanya menerima ciphertext. Setelah
            brankas dibuat, simpan <strong>recovery key</strong> di luar Kunci. Reset kata sandi tidak lewat kode Gmail ke{' '}
            {recoveryEmail}.
          </p>
          <IosInstallCard />
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
  const { unlock, hint, busy, confirmPasswordReset, recoveryEmail } = useVault()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'unlock' | 'reset'>('unlock')
  const [recoveryKey, setRecoveryKey] = useState('')
  const [next, setNext] = useState('')
  const [next2, setNext2] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await unlock(password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuka')
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
      await confirmPasswordReset(recoveryKey, next)
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
                : 'Pakai recovery key yang kamu simpan saat membuat brankas'}
            </p>
          </div>
        </div>
        <IosInstallCard />
        {mode === 'unlock' ? (
          <form className="stack" onSubmit={(e) => void onSubmit(e)}>
            <Field label="Kata sandi induk">
              <SecretInput value={password} onChange={setPassword} autoComplete="current-password" protectFromAutofill={false} />
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
            <p className="lede">
              Recovery key tidak dikirim otomatis ke {recoveryEmail}. Kalau kunci itu hilang dan kata sandi induk lupa,
              data tidak bisa dipulihkan — itu harga zero-knowledge.
            </p>
            <Field label="Recovery key">
              <TextArea
                value={recoveryKey}
                onChange={(e) => setRecoveryKey(e.target.value.toUpperCase())}
                rows={3}
                spellCheck={false}
                autoComplete="off"
                placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
              />
            </Field>
            <Field label="Kata sandi baru">
              <SecretInput value={next} onChange={setNext} autoComplete="new-password" />
            </Field>
            <Field label="Konfirmasi baru">
              <SecretInput value={next2} onChange={setNext2} autoComplete="new-password" />
            </Field>
            {error ? <p className="error">{error}</p> : null}
            <button className="btn btn-primary" type="submit" disabled={busy || !recoveryKey || !next}>
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
