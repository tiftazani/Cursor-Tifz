import { Field, TextInput } from '../components/Field'
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
  } = useVault()
  const [axMsg, setAxMsg] = useState('')
  if (!vault) return null
  const s = vault.settings
  const mac = isMacDesktop()

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
          Ikon kunci di luar kotak field. Hanya form login yang diisi/disimpan. Kartu ekstensi harus tertulis{' '}
          <strong>Versi 1.2.1</strong> — kalau masih 1.1.3, folder yang di-load belum di-git pull.
        </p>
        <ol className="steps">
          <li>
            Di Mac: <code>cd ~/Cursor-Tifz && git pull origin cursor/kunci-password-manager-4eaf</code>
          </li>
          <li>
            <code>chrome://extensions</code> → klik Reload. Kalau masih 1.1.3: Remove, lalu Load unpacked ke{' '}
            <code>~/Cursor-Tifz/kunci/extension</code>
          </li>
          <li>Buka brankas di tab Kunci, buka popup, masukkan kata sandi induk</li>
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
            Home. Kunci Helper.app dipasang ke keduanya.
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
          <ol className="steps">
            <li>
              <code>cd ~/Cursor-Tifz && git pull origin cursor/kunci-password-manager-4eaf</code>
            </li>
            <li>
              <code>cd ~/Cursor-Tifz/kunci && npm run install-service</code> — Finder harusnya langsung membuka app-nya
            </li>
            <li>
              System Settings → Privacy & Security → Accessibility → centang <strong>Kunci Helper</strong>
            </li>
          </ol>
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
