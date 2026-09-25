import { Field, SecretInput, TextInput } from '../components/Field'
import { useVault } from '../state/VaultContext'
import { isMacDesktop } from '../lib/platform'
import { promptHelperAccess, revealHelperApp } from '../lib/helper'
import { useState } from 'react'

export function AutofillView() {
  const {
    vault,
    updateSettings,
    helperOnline,
    helperAccessibility,
    helperAppInstalled,
    helperAppPath,
    fillFrontmostApp,
    helperExtensionDir,
    helperExtensionVersion,
    helperPull,
    helperInstall,
  } = useVault()
  const [axMsg, setAxMsg] = useState('')
  const [showGuide, setShowGuide] = useState(false)
  if (!vault) return null
  const s = vault.settings
  const mac = isMacDesktop()
  // Everything below comes from the daemon at runtime. Nothing here may name a
  // path on this machine: this file ships in the public bundle.
  const extensionDir = helperExtensionDir || 'kunci/extension'
  const fromHelper = Boolean(helperExtensionDir)
  const pullCmd = helperPull || 'cd <folder-clone> && git fetch origin <branch> && git checkout FETCH_HEAD'
  const installCmd = helperInstall || 'cd <folder-clone>/kunci && npm install && npm run install-service'

  async function askAccess() {
    setAxMsg('Meminta izin…')
    const res = await promptHelperAccess(s.helperUrl, s.helperToken)
    setAxMsg(
      res.ok
        ? res.trusted
          ? 'Kunci Helper sudah diizinkan.'
          : 'Dialog macOS harusnya muncul. Di Accessibility centang Kunci Helper.'
        : res.error || 'Gagal meminta izin',
    )
  }

  async function showInFinder() {
    setAxMsg('Membuka Finder…')
    const res = await revealHelperApp(s.helperUrl, s.helperToken)
    setAxMsg(res.ok ? `Finder membuka ${res.path}` : res.error || 'Gagal membuka Finder')
  }

  return (
    <div className="page">
      <header className="page-head">
        <h2>Isi otomatis</h2>
        <p className="muted">
          Website: hanya form masuk sistem. Aplikasi Mac: Kunci Helper mengisi app yang kamu pilih. Sama di cloud dan di
          localhost.
        </p>
      </header>

      <div className="card">
        <h3>Website</h3>
        <p className="muted">
          Folder ekstensi: <code>{extensionDir}</code>
          {fromHelper ? ' (dari helper Mac).' : '.'}{' '}
          Load unpacked ke folder itu <strong>sekali</strong>. Setelah itu, kalau aplikasi/helper di-update (git pull
          atau <code>npm run install-service</code>), Chrome reload sendiri. Kartu harus {helperExtensionVersion || __KUNCI_VERSION__}
          — bukan versi lama.
        </p>
        <button
          type="button"
          className="btn btn-ghost"
          aria-expanded={showGuide}
          onClick={() => setShowGuide((v) => !v)}
        >
          {showGuide ? 'Sembunyikan panduan pemasangan' : 'Panduan pemasangan'}
        </button>
        {showGuide ? (
          <>
            <ol className="steps">
              <li>
                Di Terminal:{' '}
                <code>
                  {pullCmd} && cd kunci && npm install && npm run install-service
                </code>
              </li>
              <li>
                Pertama kali saja: <code>chrome://extensions</code> → Load unpacked ke <code>{extensionDir}</code>{' '}
                (bukan folder app Cursor). Jangan Remove tiap ada update.
              </li>
              <li>
                Safari: di folder <code>kunci</code> jalankan <code>npm run install-safari</code>. Lalu Safari → Settings
                → Developer → Allow unsigned extensions → Add Temporary Extension… → pilih folder yang dibuka Finder.
                Nyalakan Kunci Autofill, lalu <strong>Always Allow on Every Website</strong>.
              </li>
              <li>Buka brankas di tab Kunci, buka popup, masukkan kata sandi induk</li>
            </ol>
            <p className="muted">
              Safari sementara hilang saat Safari ditutup — Add Temporary Extension lagi, atau{' '}
              <code>npm run install-safari -- --pack</code> (butuh Xcode). iPhone tidak bisa isi situs lain di Safari
              tanpa App Store; pakai Kunci di Layar Utama + salin berurutan.
            </p>
          </>
        ) : null}
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
          Tawarkan simpan hanya setelah login website berhasil. Login gagal tidak disimpan.
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
              Kunci Helper.app{' '}
              <strong className={helperAppInstalled ? 'ok' : 'error'}>{helperAppInstalled ? 'ada' : 'belum'}</strong>
            </div>
            <div className="status-pill">
              Accessibility{' '}
              <strong className={helperAccessibility ? 'ok' : 'error'}>{helperAccessibility ? 'diizinkan' : 'belum'}</strong>
            </div>
          </div>
          <p className="muted">
            Sidebar Finder <strong>Applications</strong> adalah <code>/Applications</code>, bukan folder Applications di
            Home. Kunci Helper.app dipasang ke keduanya. Helper hanya mengisi login yang sudah ada di brankas — tidak
            merekam ketikan, jadi tidak menyimpan username/password dari app Mac yang gagal masuk.
          </p>
          {helperAppInstalled && helperAppPath ? (
            <p className="muted">
              Sekarang ada di <code>{helperAppPath}</code>
            </p>
          ) : (
            <p className="muted">
              Belum ketemu di /Applications. Versi lama cuma nulis ke ~/Applications, dan kalau Xcode/swiftc tidak ada
              app-nya dihapus.
            </p>
          )}
          <p className="muted">
            Helper tidak boleh muncul di Dock. Kalau ikonnya numpuk: di Terminal jalankan{' '}
            <code>killall -9 &quot;Kunci Helper&quot;</code> lalu{' '}
            <code>launchctl bootout gui/$(id -u)/com.kunci.daemon</code>, baru install-service lagi.
          </p>
          <button
            type="button"
            className="btn btn-ghost"
            aria-expanded={showGuide}
            onClick={() => setShowGuide((v) => !v)}
          >
            {showGuide ? 'Sembunyikan panduan pemasangan' : 'Panduan pemasangan'}
          </button>
          {showGuide ? (
            <ol className="steps">
              <li>
                <code>{pullCmd}</code>
              </li>
              <li>
                <code>{installCmd}</code> — Finder harusnya langsung membuka app-nya
              </li>
              <li>
                System Settings → Privacy & Security → Accessibility → centang <strong>Kunci Helper</strong>
              </li>
            </ol>
          ) : null}
          <div className="row-actions">
            <button type="button" className="btn btn-primary" disabled={!helperOnline} onClick={() => void fillFrontmostApp()}>
              Isi ke app yang saya klik
            </button>
            <button type="button" className="btn" disabled={!helperOnline} onClick={() => void showInFinder()}>
              Tampilkan di Finder
            </button>
            <button type="button" className="btn" disabled={!helperOnline} onClick={() => void askAccess()}>
              Minta izin Accessibility
            </button>
          </div>
          {axMsg ? <p className="muted">{axMsg}</p> : null}
          <Field label="URL helper">
            <TextInput value={s.helperUrl} onChange={(e) => void updateSettings({ helperUrl: e.target.value })} />
          </Field>
          <Field label="Token helper (terisi otomatis jika helper nyala)">
            <SecretInput
              value={s.helperToken}
              onChange={(value) => void updateSettings({ helperToken: value.trim() })}
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
