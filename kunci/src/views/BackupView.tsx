import { useRef, useState } from 'react'
import { formatDateTime } from '../lib/time'
import { useVault } from '../state/VaultContext'
import { Field } from '../components/Field'
import { entriesToCsv } from '../lib/csv'
import { entriesToXlsx } from '../lib/xlsx'
import { entriesFromPlainFile } from '../lib/sheet'
import { downloadFile, stampFile } from '../lib/download'

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
    importPlainEntries,
  } = useVault()
  const fileRef = useRef<HTMLInputElement>(null)
  const sheetRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
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

  function exportCsv() {
    if (!vault) return
    if (
      !window.confirm(
        `Unduh ${vault.entries.length} entri sebagai CSV? File ini berisi username dan password dalam teks biasa. Jangan kirim lewat email.`,
      )
    ) {
      return
    }
    downloadFile(`kunci-logins-${stampFile()}.csv`, `\uFEFF${entriesToCsv(vault.entries)}`, 'text/csv;charset=utf-8')
  }

  function exportXlsx() {
    if (!vault) return
    if (
      !window.confirm(
        `Unduh ${vault.entries.length} entri sebagai Excel (.xlsx)? File ini berisi username dan password dalam teks biasa.`,
      )
    ) {
      return
    }
    downloadFile(
      `kunci-logins-${stampFile()}.xlsx`,
      entriesToXlsx(vault.entries),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
  }

  async function onSheet(file: File) {
    if (
      !window.confirm(
        `Impor “${file.name}”? Baris username/password akan ditambahkan ke brankas (tidak menimpa cadangan terenkripsi).`,
      )
    ) {
      return
    }
    setImporting(true)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const imported = await entriesFromPlainFile(file.name, bytes)
      await importPlainEntries(imported)
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Gagal membaca file')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <h2>Cadangan & pindah data</h2>
        <p className="muted">Cadangan terenkripsi untuk aman. Excel/CSV hanya untuk pindah data — plaintext, hapus setelah dipakai.</p>
      </header>

      <div className="card">
        <h3>Excel & CSV</h3>
        <p className="muted">
          Kolom: name, type, url, username, password, app, notes, totp, tags. Cocok untuk Google Sheets, Numbers, dan
          Excel. Cloud dan localhost memakai brankas yang sama, jadi ekspor dari mana pun isinya sama setelah sinkron.
        </p>
        <div className="row-actions">
          <button type="button" className="btn btn-primary" onClick={exportXlsx}>
            Ekspor Excel
          </button>
          <button type="button" className="btn" onClick={exportCsv}>
            Ekspor CSV
          </button>
          <button type="button" className="btn" disabled={importing} onClick={() => sheetRef.current?.click()}>
            {importing ? 'Mengimpor…' : 'Impor Excel / CSV'}
          </button>
        </div>
        <input
          ref={sheetRef}
          type="file"
          accept=".csv,.xlsx,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onSheet(f)
            e.target.value = ''
          }}
        />
      </div>

      <div className="card">
        <h3>Cadangan terenkripsi</h3>
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
          <button type="button" className="btn" onClick={() => void backupNow()}>
            Cadangkan sekarang
          </button>
          <button type="button" className="btn" onClick={() => void exportBackup()}>
            Unduh file terenkripsi
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            Pulihkan dari file
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
      </div>

      <div className="card">
        <h3>Versi di perangkat ini</h3>
        {backups.length === 0 ? (
          <p className="muted">Belum ada snapshot terenkripsi di browser ini.</p>
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
