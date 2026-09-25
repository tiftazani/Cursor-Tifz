import { useEffect, useState } from 'react'
import { Field, SecretInput, TextInput } from '../components/Field'
import { isStrongMaster } from '../lib/strength'
import { AUTO_LOCK_OPTIONS, resolveAutoLockSeconds } from '../lib/autolock'
import { IosInstallGuide } from '../components/IosInstallCard'
import { cloudHasSession, requestCloudGate } from '../lib/cloud'
import { isAndroidEntry } from '../lib/cleanup'
import { unlockErrorMessage } from '../lib/crypto'
import { useVault } from '../state/VaultContext'
import { useToast } from '../components/Toast'

/** A number box that commits only a real value. Writing straight from `onChange`
 *  meant clearing the box wrote `Number('')` = 0: the clipboard auto-clear turned
 *  itself off, and the copy gap announced "Password menyusul 0 detik". `min` and
 *  `max` are HTML hints React never enforces, so clamping happens here too. */
function NumberField({
  label,
  value,
  min,
  max,
  onCommit,
}: {
  label: string
  value: number
  min: number
  max: number
  onCommit: (n: number) => void
}) {
  const [text, setText] = useState(String(value))
  // Keep the box in step when the stored value changes underneath it (another
  // window, a reset). Adjusted during render rather than in an effect, which is
  // the pattern React recommends for deriving state from props.
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setText(String(value))
  }
  return (
    <Field label={label}>
      <TextInput
        type="number"
        min={min}
        max={max}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const n = Number(text)
          if (text.trim() === '' || !Number.isFinite(n)) {
            setText(String(value))
            return
          }
          const clamped = Math.min(max, Math.max(min, Math.round(n)))
          setText(String(clamped))
          if (clamped !== value) onCommit(clamped)
        }}
      />
    </Field>
  )
}

export function SettingsView() {
  const {
    vault,
    updateSettings,
    changeMasterPassword,
    setHint,
    hint,
    lock,
    destroyVault,
    rotateRecoveryKey,
    logoutPublic,
    hasRecoveryWrap,
    recoveryEmail,
    removeAndroidEntries,
  } = useVault()
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [next2, setNext2] = useState('')
  const [hintDraft, setHintDraft] = useState(hint)
  const [msg, setMsg] = useState('')
  const [cleanMsg, setCleanMsg] = useState('')
  const [cloudSession, setCloudSession] = useState(false)
  useEffect(() => {
    let live = true
    void cloudHasSession().then((on) => {
      if (live) setCloudSession(on)
    })
    return () => {
      live = false
    }
  }, [])
  if (!vault) return null
  const s = vault.settings
  const androidCount = vault.entries.filter(isAndroidEntry).length
  const trashCount = vault.trash.length

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
      setMsg(unlockErrorMessage(e))
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <h2>Pengaturan</h2>
        <p className="muted">Keamanan brankas, tema, dan sesi cloud. Perubahan ikut tersimpan di cloud dan di perangkat ini.</p>
      </header>

      <IosInstallGuide />

      <div className="card stack">
        <h3>Keamanan</h3>
        <Field
          label="Kunci otomatis"
          hint="Mengunci brankas (minta kata sandi induk lagi). Tidak mengeluarkan sesi cloud Gmail."
        >
          <select
            className="input"
            value={resolveAutoLockSeconds(s)}
            onChange={(e) => void updateSettings({ autoLockSeconds: Number(e.target.value) })}
          >
            {AUTO_LOCK_OPTIONS.map((option) => (
              <option key={option.seconds} value={option.seconds}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <NumberField
          label="Hapus papan klip (detik, 0 = jangan)"
          value={s.clipboardSeconds}
          min={0}
          max={120}
          onCommit={(n) => void updateSettings({ clipboardSeconds: n })}
        />
        <NumberField
          label="Jeda salin berurutan (detik)"
          value={s.sequentialCopySeconds}
          min={2}
          max={20}
          onCommit={(n) => void updateSettings({ sequentialCopySeconds: n })}
        />
        <label className="check">
          <input
            type="checkbox"
            checked={s.hibpEnabled}
            onChange={(e) => void updateSettings({ hibpEnabled: e.target.checked })}
          />{' '}
          Izinkan cek kebocoran Have I Been Pwned
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={s.autoFillWeb !== false}
            onChange={(e) => void updateSettings({ autoFillWeb: e.target.checked })}
          />{' '}
          Isi otomatis login website (ekstensi)
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={s.offerSaveWeb !== false}
            onChange={(e) => void updateSettings({ offerSaveWeb: e.target.checked })}
          />{' '}
          Tawarkan simpan password website hanya setelah login berhasil. Gagal masuk tidak ditulis ke brankas.
        </label>
      </div>

      <div className="card stack">
        <h3>Tampilan</h3>
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
        <h3>Bersihkan</h3>
        <p className="muted">
          Login aplikasi Android dari impor Chrome tidak lagi didukung. Baris baru tidak akan diimpor lagi. Entri lama
          yang masih ada bisa dipindahkan ke Sampah di sini, jadi masih bisa dikembalikan.
        </p>
        {androidCount > 0 ? (
          <>
            <p className="muted">
              Ada {androidCount} entri aplikasi Android di brankas ini.
              {trashCount > 0 ? ` Sampah saat ini berisi ${trashCount} entri, tidak ikut terhapus.` : ''}
            </p>
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (
                  window.confirm(
                    `Pindahkan ${androidCount} entri aplikasi Android ke Sampah? Kamu masih bisa mengembalikannya dari Sampah.`,
                  )
                ) {
                  void removeAndroidEntries().then((moved) => {
                    setCleanMsg(
                      moved ? `${moved} entri aplikasi Android dipindahkan ke Sampah.` : 'Tidak ada yang dipindahkan.',
                    )
                  })
                }
              }}
            >
              Pindahkan {androidCount} entri Android ke Sampah
            </button>
          </>
        ) : (
          <p className="muted">Tidak ada entri aplikasi Android di brankas ini.</p>
        )}
        {cleanMsg ? <p className="muted">{cleanMsg}</p> : null}
      </div>

      <div className="card stack">
        <h3>Recovery key</h3>
        <p className="muted">
          {hasRecoveryWrap
            ? 'Brankas ini punya recovery wrap. Kunci plaintext hanya ada di tempat kamu menyimpannya.'
            : 'Brankas ini belum punya recovery key. Buka lalu buat yang baru.'}
        </p>
        <button
          type="button"
          className="btn"
          onClick={() => {
            if (
              window.confirm(
                'Recovery key lama tidak berlaku lagi. Pastikan kamu bisa menyimpan yang baru sekarang.',
              )
            ) {
              // `rotateRecoveryKey` throws when the vault is locked and can reject
              // on a failed write. The old `void` call turned both into an unhandled
              // rejection: the confirm dialog closed and nothing happened.
              void rotateRecoveryKey().catch((err) => {
                toast.push(err instanceof Error ? err.message : 'Gagal membuat recovery key baru', 'danger')
              })
            }
          }}
        >
          Buat recovery key baru
        </button>
      </div>

      <div className="card stack">
        <h3>Sesi</h3>
        <button type="button" className="btn" onClick={lock}>
          Kunci sekarang
        </button>
        <button type="button" className="btn" onClick={() => void logoutPublic().catch(() => toast.push('Gagal keluar dari sesi', 'danger'))}>
          Keluar dari sesi cloud ({recoveryEmail})
        </button>
        {cloudSession ? (
          <p className="muted">Sesi cloud aktif. Perubahan ikut tersimpan di server.</p>
        ) : (
          <>
            <p className="muted">
              Belum ada sesi cloud di browser ini, jadi perubahan hanya tersimpan di perangkat ini. Buka gerbang kode
              email untuk menyalakan sinkron.
            </p>
            <button
              type="button"
              className="btn"
              onClick={() => {
                requestCloudGate()
                window.location.reload()
              }}
            >
              Buka gerbang kode email
            </button>
          </>
        )}
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => {
            if (
              window.confirm(
                'Hapus brankas dari browser ini? Salinan terenkripsi di cloud (localhost dan URL publik) tidak ikut terhapus.',
              )
            ) {
              // If the IndexedDB delete fails, the vault is still on disk and the UI
              // must not imply it is gone. `destroyVault` only announces success
              // after `vaultDb.destroy()` resolves, so a rejection has to be caught.
              void destroyVault().catch((err) => {
                toast.push(err instanceof Error ? err.message : 'Gagal menghapus brankas', 'danger')
              })
            }
          }}
        >
          Hancurkan brankas di perangkat ini
        </button>
      </div>
    </div>
  )
}
