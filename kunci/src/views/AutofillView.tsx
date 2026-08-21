import { Field, TextInput } from '../components/Field'
import { useVault } from '../state/VaultContext'

export function AutofillView() {
  const { vault, updateSettings, helperOnline, fillFrontmostApp } = useVault()
  if (!vault) return null
  const s = vault.settings

  return (
    <div className="page">
      <header className="page-head">
        <h2>Autofill</h2>
        <p className="muted">
          Di website, Kunci meniru Google Password Manager: mengisi login yang sudah disimpan, lalu menawar menyimpan
          username/password baru ke brankas. App desktop Mac bisa diisi, tetapi macOS tidak mengizinkan menyalin sandi
          diam-diam dari aplikasi lain.
        </p>
      </header>

      <div className="card">
        <h3>Website (ekstensi browser)</h3>
        <p className="muted">
          Setelah brankas terbuka di ekstensi, login ke situs seperti biasa. Kunci mengisi otomatis jika ada satu akun,
          atau menampilkan pilihan. Sesudah kamu masuk, muncul bar: Simpan / Perbarui / Jangan.
        </p>
        <ol className="steps">
          <li>Chrome, Edge, atau Arc → <code>chrome://extensions</code> → Developer mode</li>
          <li>
            Load unpacked → folder <code>kunci/extension</code>. Kalau ekstensi sudah terpasang, klik Reload.
          </li>
          <li>Buka tab Kunci, buka brankas (ekstensi menyalin ciphertext), lalu klik ikon Kunci di toolbar dan masukkan kata sandi induk</li>
          <li>
            Di halaman login, field terisi sendiri, atau klik tombol <strong>K</strong> / <kbd>⌘⇧L</kbd>
          </li>
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
          Tawarkan simpan atau perbarui password setelah login
        </label>
        <p className="muted">Safari: Develop → Show Feature Flags → allow unsigned extensions, lalu load folder yang sama.</p>
      </div>

      <div className="card mac-only">
        <h3>Aplikasi desktop Mac</h3>
        <p>
          Helper status:{' '}
          <strong className={helperOnline ? 'ok' : 'error'}>{helperOnline ? 'terhubung' : 'tidak aktif'}</strong>
        </p>
        <p className="muted">
          Apple tidak memberi jalan resmi untuk “mengambil” password dari Slack, Mail, atau app lain tanpa keylogger.
          Kunci tidak melakukan itu. Yang bisa: menyimpan login secara manual (tipe Aplikasi Mac), lalu mengisi ke jendela
          yang kamu pilih.
        </p>
        <ol className="steps">
          <li>
            Sekali saja, di folder <code>kunci</code>: <code>npm run install-service</code>
          </li>
          <li>Izinkan Node di System Settings → Privacy & Security → Accessibility</li>
          <li>Simpan entri bertipe Aplikasi Mac (nama app harus mirip, misalnya Slack)</li>
          <li>Klik tombol di bawah, lalu dalam 2 detik klik jendela login app tersebut</li>
        </ol>
        <div className="row-actions">
          <button type="button" className="btn btn-primary" disabled={!helperOnline} onClick={() => void fillFrontmostApp()}>
            Isi ke app yang saya klik
          </button>
        </div>
        <Field label="URL helper">
          <TextInput value={s.helperUrl} onChange={(e) => void updateSettings({ helperUrl: e.target.value })} />
        </Field>
        <Field label="Token helper">
          <TextInput
            value={s.helperToken}
            onChange={(e) => void updateSettings({ helperToken: e.target.value.trim() })}
            placeholder="tempel token dari terminal helper"
          />
        </Field>
      </div>
    </div>
  )
}
