import { useState, type FormEvent } from 'react'
import { Field, SecretInput, StrengthBar, TextInput } from '../components/Field'
import { IconKey, IconLock } from '../components/Icons'
import { isStrongMaster, passwordStrength } from '../lib/strength'
import { useVault } from '../state/VaultContext'

export function SetupScreen() {
  const { setup, busy } = useVault()
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
            Data dienkripsi di perangkat ini dengan kata sandi induk. Tidak ada akun cloud, dan kami tidak bisa memulihkan
            brankas jika kata sandi itu lupa.
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
  const { unlock, hint, busy } = useVault()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await unlock(password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuka')
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
            <h1>Kunci terkunci</h1>
            <p>Masukkan kata sandi induk untuk membuka brankas</p>
          </div>
        </div>
        <form className="stack" onSubmit={(e) => void onSubmit(e)}>
          <Field label="Kata sandi induk">
            <SecretInput value={password} onChange={setPassword} autoComplete="current-password" />
          </Field>
          {hint ? <p className="hint-pill">Petunjuk: {hint}</p> : null}
          {error ? <p className="error">{error}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={busy || !password}>
            {busy ? 'Membuka…' : 'Buka brankas'}
          </button>
        </form>
      </div>
    </div>
  )
}
