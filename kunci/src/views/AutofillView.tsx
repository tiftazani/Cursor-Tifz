import { Field, TextInput } from '../components/Field'
import { useVault } from '../state/VaultContext'
import { isMacDesktop } from '../lib/platform'

export function AutofillView() {
  const { vault, updateSettings, helperOnline, helperAccessibility, fillFrontmostApp } = useVault()
  if (!vault) return null
  const s = vault.settings
  const mac = isMacDesktop()

  return (
    <div className="page">
      <header className="page-head">
        <h2>Isi otomatis</h2>
        <p className="muted">
          Website: hanya form masuk sistem. Aplikasi Mac: helper mengisi app yang kamu pilih. Sama di cloud dan di
          localhost.
        </p>
      </header>

      <div className="card">
        <h3>Website</h3>
        <p className="muted">
          Ikon kunci dipasang di luar kotak field, bukan di dalam. Kunci mengisi dan menawar simpan hanya jika form itu
          untuk login — bukan daftar akun, ganti password, pencarian, atau pembayaran.
        </p>
        <ol className="steps">
          <li>
            Chrome / Edge / Arc → <code>chrome://extensions</code> → Load unpacked → folder <code>kunci/extension</code>
          </li>
          <li>Buka brankas di tab Kunci, lalu buka popup ekstensi dan masukkan kata sandi induk</li>
          <li>Di halaman login, field terisi atau klik ikon kunci di kanan luar kotak / <kbd>⌘⇧L</kbd></li>
        </ol>
        <label className="check">
          <input
            type="checkbox"
            checked={s.autoFillWeb !== false}
            onChange={(e) => void updateSettings({ autoFillWeb: e.target.checked })}
          />
          Isi otomatis jika hanya ada satu login untuk situs ini
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={s.offerSaveWeb !== false}
            onChange={(e) => void updateSettings({ offerSaveWeb: e.target.checked })}
          />
          Tawarkan simpan setelah login berhasil
        </label>
      </div>

      {mac ? (
        <div className="card">
          <h3>Aplikasi desktop Mac</h3>
          <div className="status-grid">
            <div className="status-pill">
              Helper <strong className={helperOnline ? 'ok' : 'error'}>{helperOnline ? 'terhubung' : 'mati'}</strong>
            </div>
            <div className="status-pill">
              Accessibility{' '}
              <strong className={helperAccessibility ? 'ok' : 'error'}>{helperAccessibility ? 'aktif' : 'belum'}</strong>
            </div>
          </div>
          <p className="muted">
            Helper di <code>127.0.0.1:8780</code> dipakai baik kamu membuka kunci-tifta.netlify.app maupun localhost.
            Kunci tidak menyalin ketikan dari app lain.
          </p>
          <ol className="steps">
            <li>
              Sekali saja: <code>npm run install-service</code> di folder <code>kunci</code>
            </li>
            <li>System Settings → Privacy & Security → Accessibility → Node dan osascript</li>
            <li>Simpan entri (tipe Aplikasi Mac atau Website), buka app tujuan, lalu isi dari Kunci</li>
          </ol>
          <div className="row-actions">
            <button type="button" className="btn btn-primary" disabled={!helperOnline} onClick={() => void fillFrontmostApp()}>
              Isi ke app yang saya klik
            </button>
          </div>
          <Field label="URL helper">
            <TextInput value={s.helperUrl} onChange={(e) => void updateSettings({ helperUrl: e.target.value })} />
          </Field>
          <Field label="Token helper (terisi otomatis jika helper nyala)">
            <TextInput
              value={s.helperToken}
              onChange={(e) => void updateSettings({ helperToken: e.target.value.trim() })}
              placeholder="otomatis dari 127.0.0.1:8780"
            />
          </Field>
        </div>
      ) : (
        <div className="card">
          <h3>Aplikasi desktop</h3>
          <p className="muted">
            Isi ke aplikasi native hanya di Mac dengan helper. Di iPhone, pakai isi website lewat Safari setelah Kunci
            dipasang ke layar utama, plus salin berurutan.
          </p>
        </div>
      )}
    </div>
  )
}
