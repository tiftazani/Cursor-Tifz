import { useState } from 'react'
import { Field, SecretInput, TextInput } from '../components/Field'
import { isStrongMaster } from '../lib/strength'
import { useVault } from '../state/VaultContext'

export function SettingsView() {
  const { vault, updateSettings, changeMasterPassword, setHint, hint, lock, destroyVault } = useVault()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [next2, setNext2] = useState('')
  const [hintDraft, setHintDraft] = useState(hint)
  const [msg, setMsg] = useState('')
  if (!vault) return null
  const s = vault.settings

  async function onChangeMaster() {
    setMsg('')
    if (next !== next2) {
      setMsg('Konfirmasi tidak sama')
      return
    }
    if (!isStrongMaster(next)) {
      setMsg('Kata sandi baru kurang kuat')
      return
    }
    try {
      await changeMasterPassword(current, next)
      setCurrent('')
      setNext('')
      setNext2('')
      setMsg('Kata sandi induk diganti')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal')
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <h2>Pengaturan</h2>
        <p className="muted">Kunci menyimpan brankas terenkripsi di browser ini (IndexedDB).</p>
      </header>

      <div className="card stack">
        <h3>Keamanan</h3>
        <Field label="Kunci otomatis (menit, 0 = jangan)">
          <TextInput
            type="number"
            min={0}
            max={120}
            value={s.autoLockMinutes}
            onChange={(e) => void updateSettings({ autoLockMinutes: Number(e.target.value) })}
          />
        </Field>
        <Field label="Hapus papan klip (detik, 0 = jangan)">
          <TextInput
            type="number"
            min={0}
            max={120}
            value={s.clipboardSeconds}
            onChange={(e) => void updateSettings({ clipboardSeconds: Number(e.target.value) })}
          />
        </Field>
        <Field label="Jeda salin berurutan (detik)">
          <TextInput
            type="number"
            min={2}
            max={20}
            value={s.sequentialCopySeconds}
            onChange={(e) => void updateSettings({ sequentialCopySeconds: Number(e.target.value) })}
          />
        </Field>
        <label className="check">
          <input
            type="checkbox"
            checked={s.hibpEnabled}
            onChange={(e) => void updateSettings({ hibpEnabled: e.target.checked })}
          />{' '}
          Izinkan cek kebocoran Have I Been Pwned
        </label>
        <Field label="Tema">
          <select
            className="input"
            value={s.theme}
            onChange={(e) => void updateSettings({ theme: e.target.value as typeof s.theme })}
          >
            <option value="dark">Gelap</option>
            <option value="light">Terang</option>
            <option value="system">Ikuti sistem</option>
          </select>
        </Field>
      </div>

      <div className="card stack">
        <h3>Kata sandi induk</h3>
        <Field label="Petunjuk">
          <TextInput value={hintDraft} onChange={(e) => setHintDraft(e.target.value)} />
        </Field>
        <button type="button" className="btn" onClick={() => void setHint(hintDraft)}>
          Simpan petunjuk
        </button>
        <Field label="Kata sandi sekarang">
          <SecretInput value={current} onChange={setCurrent} autoComplete="current-password" />
        </Field>
        <Field label="Kata sandi baru">
          <SecretInput value={next} onChange={setNext} autoComplete="new-password" />
        </Field>
        <Field label="Konfirmasi baru">
          <SecretInput value={next2} onChange={setNext2} autoComplete="new-password" />
        </Field>
        {msg ? <p className="muted">{msg}</p> : null}
        <button type="button" className="btn" onClick={() => void onChangeMaster()}>
          Ganti kata sandi induk
        </button>
      </div>

      <div className="card stack">
        <h3>Sesi</h3>
        <button type="button" className="btn" onClick={lock}>
          Kunci sekarang
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => {
            if (window.confirm('Hapus brankas dari browser ini? File cadangan di disk tidak ikut terhapus.')) {
              void destroyVault()
            }
          }}
        >
          Hancurkan brankas di perangkat ini
        </button>
      </div>
    </div>
  )
}
