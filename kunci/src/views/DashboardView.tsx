import { useMemo, useState } from 'react'
import { analyzeHealth } from '../lib/health'
import { findDuplicateClusters, maskAccount } from '../lib/duplicates'
import { relativeTime } from '../lib/time'
import { useVault } from '../state/VaultContext'
import { useToast } from '../components/Toast'
import { IconKey, IconShield, IconSpark, IconStar } from '../components/Icons'

export function DashboardView({
  onOpenVault,
  onOpenEntry,
  onGenerate,
  onHealth,
}: {
  onOpenVault: () => void
  onOpenEntry: (id: string) => void
  onGenerate: () => void
  onHealth: () => void
}) {
  const { vault, mergeEntries, deleteEntry } = useVault()
  const toast = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [keepByCluster, setKeepByCluster] = useState<Record<string, string>>({})

  const entries = vault?.entries
  const report = useMemo(() => analyzeHealth(entries ?? []), [entries])
  const clusters = useMemo(() => findDuplicateClusters(entries ?? []), [entries])
  const types = useMemo(() => {
    const list = entries ?? []
    const login = list.filter((e) => e.type === 'login').length
    const app = list.filter((e) => e.type === 'app').length
    const other = list.length - login - app
    return [
      { id: 'login', label: 'Website', n: login },
      { id: 'app', label: 'Aplikasi', n: app },
      { id: 'other', label: 'Lainnya', n: other },
    ]
  }, [entries])
  const recent = useMemo(
    () => [...(entries ?? [])].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6),
    [entries],
  )
  const list = entries ?? []
  const maxType = Math.max(1, ...types.map((t) => t.n))
  const favorites = list.filter((e) => e.favorite).length
  const used = list.filter((e) => e.lastUsedAt).length

  if (!vault) return null

  async function mergeCluster(clusterId: string, keepId: string, memberIds: string[]) {
    setBusyId(clusterId)
    try {
      await mergeEntries(keepId, memberIds.filter((id) => id !== keepId))
      toast.push('Entri digabung. Yang lain masuk sampah.')
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Gagal menggabungkan', 'danger')
    } finally {
      setBusyId(null)
    }
  }

  async function dropOthers(clusterId: string, keepId: string, memberIds: string[]) {
    if (!window.confirm('Entri yang tidak dipilih masuk sampah. Yang dipilih tetap ada.')) return
    setBusyId(clusterId)
    try {
      for (const id of memberIds) {
        if (id !== keepId) await deleteEntry(id)
      }
      toast.push('Duplikat dibuang ke sampah.')
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Gagal menghapus', 'danger')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="page dash">
      <header className="dash-hero">
        <div>
          <p className="dash-kicker">Ringkasan brankas</p>
          <h2>Keadaan akun, bukan daftar sandi</h2>
          <p className="muted">
            Skor dan duplikat dihitung di perangkat. Username/password tidak ditampilkan di sini.
          </p>
        </div>
        <ScoreRing score={report.score} />
      </header>

      <div className="dash-stats">
        <button type="button" className="card dash-stat" onClick={onOpenVault}>
          <strong>{list.length}</strong>
          <span>Entri</span>
        </button>
        <div className="card dash-stat">
          <strong className={clusters.length ? 'warn-text' : ''}>{clusters.length}</strong>
          <span>Kelompok duplikat</span>
        </div>
        <div className="card dash-stat">
          <strong className={report.weak ? 'warn-text' : ''}>{report.weak}</strong>
          <span>Password lemah</span>
        </div>
        <div className="card dash-stat">
          <strong>{used}</strong>
          <span>Pernah dipakai</span>
        </div>
      </div>

      <div className="dash-grid">
        <section className="card">
          <h3>Komposisi</h3>
          <div className="dash-bars">
            {types.map((t) => (
              <div key={t.id} className="dash-bar-row">
                <span>{t.label}</span>
                <i>
                  <b style={{ width: `${(t.n / maxType) * 100}%` }} />
                </i>
                <em>{t.n}</em>
              </div>
            ))}
          </div>
          <p className="meta-line">
            {favorites} favorit · skor kesehatan {report.score}/100
          </p>
        </section>

        <section className="card">
          <div className="split">
            <h3>Baru diubah</h3>
            <button type="button" className="btn btn-ghost" onClick={onOpenVault}>
              Buka brankas
            </button>
          </div>
          {recent.length === 0 ? (
            <p className="muted">Belum ada entri. Generator bisa bikin sandi baru, lalu simpan di brankas.</p>
          ) : (
            <ul className="dash-recent">
              {recent.map((e) => (
                <li key={e.id}>
                  <button type="button" className="linkish" onClick={() => onOpenEntry(e.id)}>
                    {e.favorite ? <IconStar size={12} /> : null} {e.name || 'Tanpa nama'}
                  </button>
                  <span className="muted">{relativeTime(e.updatedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card dash-dupes">
        <div className="split">
          <div>
            <h3>Rekomendasi duplikat</h3>
            <p className="muted">
              Situs yang sama (agoda.com vs www.agoda.com), nama mirip, atau login dobel. Gabungkan, atau buang yang
              tidak dipakai.
            </p>
          </div>
        </div>
        {clusters.length === 0 ? (
          <p className="ok">Tidak ada duplikat yang ketahuan.</p>
        ) : (
          <ul className="dupe-list">
            {clusters.map((c) => {
              const keepId = keepByCluster[c.id] ?? c.keepId
              const busy = busyId === c.id
              return (
                <li key={c.id} className="dupe-card">
                  <header>
                    <strong>{c.title}</strong>
                    <span className={`pill ${c.passwordConflict ? 'pill-weak' : ''}`}>
                      {c.suggestion === 'merge' ? 'Gabungkan' : 'Cek dulu'}
                    </span>
                  </header>
                  <p className="muted">{c.detail}</p>
                  {c.passwordConflict ? (
                    <p className="warn-text">Password-nya beda. Pilih mana yang disimpan, atau buang yang salah.</p>
                  ) : null}
                  <ul className="dupe-members">
                    {c.members.map((m) => (
                      <li key={m.id}>
                        <label className="check">
                          <input
                            type="radio"
                            name={`keep-${c.id}`}
                            checked={keepId === m.id}
                            onChange={() => setKeepByCluster((prev) => ({ ...prev, [c.id]: m.id }))}
                          />
                          <span>
                            <button type="button" className="linkish" onClick={() => onOpenEntry(m.id)}>
                              {m.name}
                            </button>
                            <em>
                              {m.host || 'tanpa situs'} · {maskAccount(m.username)}
                            </em>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={() => void mergeCluster(c.id, keepId, c.memberIds)}
                    >
                      Gabungkan ke yang dipilih
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={busy}
                      onClick={() => void dropOthers(c.id, keepId, c.memberIds)}
                    >
                      Buang yang lain
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="dash-actions">
        <button type="button" className="btn btn-primary" onClick={onOpenVault}>
          <IconKey size={16} /> Brankas
        </button>
        <button type="button" className="btn" onClick={onGenerate}>
          <IconSpark size={16} /> Generator
        </button>
        <button type="button" className="btn" onClick={onHealth}>
          <IconShield size={16} /> Kesehatan
        </button>
      </div>
    </div>
  )
}

function ScoreRing({ score }: { score: number }) {
  const r = 52
  const c = 2 * Math.PI * r
  const offset = c * (1 - Math.min(100, Math.max(0, score)) / 100)
  const tone = score >= 80 ? 'var(--ok)' : score >= 50 ? 'var(--warn)' : 'var(--danger)'
  return (
    <svg className="score-ring" viewBox="0 0 128 128" aria-label={`Skor ${score} dari 100`}>
      <circle cx="64" cy="64" r={r} fill="none" stroke="var(--line)" strokeWidth="10" />
      <circle
        cx="64"
        cy="64"
        r={r}
        fill="none"
        stroke={tone}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 64 64)"
      />
      <text x="64" y="60" textAnchor="middle" className="score-num">
        {score}
      </text>
      <text x="64" y="78" textAnchor="middle" className="score-sub">
        skor
      </text>
    </svg>
  )
}
