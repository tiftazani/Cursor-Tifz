import { Field, TextInput } from '../components/Field'
import { useVault } from '../state/VaultContext'

export function AutofillView() {
  const { vault, updateSettings, helperOnline } = useVault()
  if (!vault) return null
  const s = vault.settings

  return (
    <div className="page">
      <header className="page-head">
        <h2>Autofill</h2>
        <p className="muted">Isi username dan password ke website atau aplikasi desktop Mac.</p>
      </header>

      <div className="card">
        <h3>Website (ekstensi browser)</h3>
        <ol className="steps">
          <li>Buka Chrome, Edge, atau Arc → <code>chrome://extensions</code></li>
          <li>Nyalakan Developer mode</li>
          <li>
            Load unpacked, pilih folder <code>kunci/extension</code> di repo ini
          </li>
          <li>Buka kunci di tab browser, buka brankas — ekstensi akan menyalin brankas terenkripsi</li>
          <li>
            Di halaman login, klik ikon Kunci di samping field password, atau tekan <kbd>⌘⇧L</kbd>
          </li>
        </ol>
        <p className="muted">Safari: Develop → Show Feature Flags → allow unsigned extensions, lalu load folder yang sama.</p>
      </div>

      <div className="card">
        <h3>Aplikasi desktop Mac</h3>
        <p>
          Helper status:{' '}
          <strong className={helperOnline ? 'ok' : 'error'}>{helperOnline ? 'terhubung' : 'tidak aktif'}</strong>
        </p>
        <ol className="steps">
          <li>
            Sekali saja, di folder <code>kunci</code>: <code>npm run install-service</code>
          </li>
          <li>Setelah itu Kunci hidup terus di <code>http://127.0.0.1:8780</code> — terminal boleh ditutup</li>
          <li>
            Izinkan Node di System Settings → Privacy & Security → Accessibility (untuk isi app Mac)
          </li>
          <li>Fokuskan aplikasi tujuan, di Kunci pilih entri → <em>Isi ke app Mac</em></li>
        </ol>
        <p className="muted">
          Helper hanya mengisi app di Mac ini. Reset kata sandi memakai recovery key, bukan DEK di disk.
        </p>
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
