import { useState } from 'react'
import { analyzeHealth } from '../lib/health'
import { pwnedCount } from '../lib/hibp'
import { useVault } from '../state/VaultContext'

export function HealthView({ onOpen }: { onOpen: (id: string) => void }) {
  const { vault } = useVault()
  const [pwned, setPwned] = useState<{ id: string; count: number }[] | null>(null)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  if (!vault) return null
  const report = analyzeHealth(vault.entries)

  async function checkBreaches() {
    if (!vault?.settings.hibpEnabled) return
    setChecking(true)
    setError('')
    try {
      const found: { id: string; count: number }[] = []
      for (const e of vault.entries) {
        if (!e.password) continue
        const count = await pwnedCount(e.password)
        if (count > 0) found.push({ id: e.id, count })
      }
      setPwned(found)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal cek kebocoran')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <h2>Kesehatan brankas</h2>
        <p className="muted">Skor {report.score}/100 · {vault.entries.length} entri</p>
      </header>
      <div className="stat-grid">
        <div className="card stat">
          <strong>{report.weak}</strong>
          <span>Lemah</span>
        </div>
        <div className="card stat">
          <strong>{report.reused}</strong>
          <span>Dipakai ulang</span>
        </div>
        <div className="card stat">
          <strong>{report.old}</strong>
          <span>Usang</span>
        </div>
        <div className="card stat">
          <strong>{report.short}</strong>
          <span>Pendek</span>
        </div>
      </div>
      <div className="card">
        <div className="split">
          <div>
            <h3>Cek kebocoran</h3>
            <p className="muted">
              Hanya 5 karakter pertama hash SHA-1 yang dikirim ke Have I Been Pwned (k-anonymity). Password utuh tidak pernah
              keluar dari perangkat.
            </p>
          </div>
          <button type="button" className="btn" onClick={() => void checkBreaches()} disabled={checking || !vault.settings.hibpEnabled}>
            {checking ? 'Memeriksa…' : 'Cek kebocoran'}
          </button>
        </div>
        {error ? <p className="error">{error}</p> : null}
        {pwned ? (
          pwned.length === 0 ? (
            <p className="ok">Tidak ada password yang muncul di database kebocoran.</p>
          ) : (
            <ul className="issue-list">
              {pwned.map((p) => {
                const e = vault.entries.find((x) => x.id === p.id)
                return (
                  <li key={p.id}>
                    <button type="button" className="linkish" onClick={() => onOpen(p.id)}>
                      {e?.name ?? p.id}
                    </button>
                    <span className="muted">terlihat {p.count.toLocaleString('id-ID')} kali</span>
                  </li>
                )
              })}
            </ul>
          )
        ) : null}
      </div>
      <div className="card">
        <h3>Temuan</h3>
        {report.issues.length === 0 ? (
          <p className="ok">Tidak ada masalah yang terdeteksi. Bagus.</p>
        ) : (
          <ul className="issue-list">
            {report.issues.map((i) => (
              <li key={i.id}>
                <button type="button" className="linkish" onClick={() => onOpen(i.entryId)}>
                  {i.entryName}
                </button>
                <span className={`pill pill-${i.kind}`}>{i.kind}</span>
                <span className="muted">{i.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
