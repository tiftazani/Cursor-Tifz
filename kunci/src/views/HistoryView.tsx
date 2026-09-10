import { flattenHistory } from '../lib/history'
import { formatDateTime } from '../lib/time'
import { useVault } from '../state/VaultContext'

export function HistoryView({ onOpen }: { onOpen: (id: string) => void }) {
  const { vault, copySecret } = useVault()
  if (!vault) return null
  const rows = flattenHistory(vault.entries)

  return (
    <div className="page">
      <header className="page-head">
        <h2>Riwayat kredensial</h2>
        <p className="muted">Username dan password lama tersimpan tiap kali kamu mengganti entri.</p>
      </header>
      {rows.length === 0 ? (
        <div className="card empty">Belum ada riwayat. Riwayat muncul setelah password atau username diganti.</div>
      ) : (
        <div className="card">
          <ul className="timeline">
            {rows.map((row) => (
              <li key={row.record.id}>
                <button type="button" className="linkish" onClick={() => onOpen(row.entryId)}>
                  {row.entryName}
                </button>
                <div className="muted">{formatDateTime(row.record.changedAt)}</div>
                <div className="row-actions">
                  <span>{row.record.username || 'tanpa username'}</span>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => void copySecret('Password lama', row.record.password ?? '')}
                  >
                    Salin password lama
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
