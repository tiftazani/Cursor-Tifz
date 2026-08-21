import { useRef } from 'react'
import { formatDateTime } from '../lib/time'
import { useVault } from '../state/VaultContext'
import { Field } from '../components/Field'

export function BackupView() {
  const {
    vault,
    backups,
    backupFolderName,
    updateSettings,
    exportBackup,
    backupNow,
    pickBackupFolder,
    restoreBackup,
    restoreIdbBackup,
    importCsvText,
  } = useVault()
  const fileRef = useRef<HTMLInputElement>(null)
  const csvRef = useRef<HTMLInputElement>(null)
  if (!vault) return null

  async function onRestoreFile(file: File, mode: 'replace' | 'merge') {
    const json = JSON.parse(await file.text()) as unknown
    const password = window.prompt('Kata sandi induk untuk file cadangan ini:')
    if (!password) return
    await restoreBackup(json, password, mode)
  }

  async function onRestoreSnap(id: string) {
    const password = window.prompt('Kata sandi induk (yang dipakai saat cadangan ini dibuat):')
    if (!password) return
    await restoreIdbBackup(id, password)
  }

  async function onCsv(file: File) {
    await importCsvText(await file.text())
  }

  return (
    <div className="page">
      <header className="page-head">
        <h2>Cadangan</h2>
        <p className="muted">File cadangan tetap terenkripsi. Simpan di disk Mac, iCloud Drive, atau disk eksternal.</p>
      </header>

      <div className="card">
        <h3>Otomatis</h3>
        <Field label="Jadwal">
          <select
            className="input"
            value={vault.settings.autoBackup}
            onChange={(e) => void updateSettings({ autoBackup: e.target.value as typeof vault.settings.autoBackup })}
          >
            <option value="off">Mati</option>
            <option value="on-change">Setiap ada perubahan</option>
            <option value="hourly">Tiap jam</option>
            <option value="daily">Tiap hari</option>
          </select>
        </Field>
        <Field label="Jumlah versi di perangkat">
          <input
            className="input"
            type="number"
            min={3}
            max={40}
            value={vault.settings.backupKeep}
            onChange={(e) => void updateSettings({ backupKeep: Number(e.target.value) })}
          />
        </Field>
        <p className="muted">Folder Mac: {backupFolderName ?? 'belum dipilih (Chrome/Edge)'}</p>
        <div className="row-actions">
          <button type="button" className="btn" onClick={() => void pickBackupFolder()}>
            Pilih folder cadangan
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void backupNow()}>
            Cadangkan sekarang
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Manual</h3>
        <div className="row-actions">
          <button type="button" className="btn" onClick={() => void exportBackup()}>
            Unduh file terenkripsi
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            Pulihkan dari file
          </button>
          <button type="button" className="btn" onClick={() => csvRef.current?.click()}>
            Impor CSV
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onRestoreFile(f, 'merge')
            e.target.value = ''
          }}
        />
        <input
          ref={csvRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onCsv(f)
            e.target.value = ''
          }}
        />
        <p className="muted">CSV (Chrome/Bitwarden) tidak terenkripsi. Hanya untuk pindah data, lalu hapus filenya.</p>
      </div>

      <div className="card">
        <h3>Versi di perangkat ini</h3>
        {backups.length === 0 ? (
          <p className="muted">Belum ada snapshot.</p>
        ) : (
          <ul className="issue-list">
            {backups.map((b) => (
              <li key={b.id}>
                <span>{formatDateTime(b.createdAt)}</span>
                <span className="pill">{b.reason}</span>
                <button type="button" className="btn btn-ghost" onClick={() => void onRestoreSnap(b.id)}>
                  Pulihkan
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
