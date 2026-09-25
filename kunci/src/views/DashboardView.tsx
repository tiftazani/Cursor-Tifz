import { useMemo, useState } from 'react'
import { analyzeHealth, summarizeIssues, type IssueKind } from '../lib/health'
import { findDuplicateClusters, maskAccount } from '../lib/duplicates'
import { relativeTime } from '../lib/time'
import { hostFromUrl } from '../lib/match'
import { useVault } from '../state/VaultContext'
import { useToast } from '../components/Toast'
import { EntryGlyph } from '../components/EntryGlyph'
import { IconCopy } from '../components/Icons'
import type { AppView } from '../types'

const KIND_LABEL: Record<IssueKind, string> = {
  reused: 'dipakai ulang',
  weak: 'lemah',
  short: 'pendek',
  old: 'usang',
  pwned: 'bocor',
  insecure: 'situs tidak aman',
  duplicate: 'duplikat',
}

export function DashboardView({
  onOpenVault,
  onOpenEntry,
  onNavigate,
}: {
  onOpenVault: () => void
  onOpenEntry: (id: string) => void
  onNavigate: (view: AppView) => void
}) {
  const { vault, mergeEntries, deleteEntry, copySecret, helperOnline, helperAccessibility, backups, hasRecoveryWrap } =
    useVault()
  const toast = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [keepByCluster, setKeepByCluster] = useState<Record<string, string>>({})

  const entries = vault?.entries
  const report = useMemo(() => analyzeHealth(entries ?? []), [entries])
  const summary = useMemo(() => summarizeIssues(report.issues), [report])
  const clusters = useMemo(() => findDuplicateClusters(entries ?? []), [entries])
  const recent = useMemo(
    () =>
      [...(entries ?? [])]
        .sort((a, b) => (b.lastUsedAt ?? b.updatedAt) - (a.lastUsedAt ?? a.updatedAt))
        .slice(0, 3),
    [entries],
  )

  if (!vault) return null
  const list = vault.entries
  const favorites = list.filter((e) => e.favorite).length
  const withOtp = list.filter((e) => e.totpSecret).length
  const lastBackup = backups.length ? Math.max(...backups.map((b) => b.createdAt)) : null
  const lockMinutes = Math.round(vault.settings.autoLockSeconds / 60)
  const top = summary.top ? list.find((e) => e.id === summary.top!.entryId) : undefined

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
      <div className="dash-v2-hero">
        <h1>Ini brankas<br /><em>kamu hari ini</em></h1>
        <section className="card dash-v2-overview">
          <div className="split"><h2>Ikhtisar brankas</h2><button type="button" className="linkish" onClick={onOpenVault}>Buka brankas ›</button></div>
          <div className="dash-v2-stats">
            <button type="button" onClick={onOpenVault}><strong>{list.length}</strong><span>Entri aktif</span></button>
            <div><strong>{favorites}</strong><span>Favorit</span></div>
            <div><strong>{vault.trash.length}</strong><span>Di sampah</span></div>
          </div>
        </section>
      </div>

      <div className="dash-v2-actions">
        <section className="card dash-v2-panel">
          <div className="dash-v2-panel-head risk"><h2>Perlu tindakan <small>{summary.total} temuan · {summary.entries} entri</small></h2><button type="button" className="linkish" onClick={() => onNavigate('health')}>Kesehatan ›</button></div>
          {summary.total ? (
            <>
              <p className="dash-v2-explain">Satu entri bisa punya lebih dari satu temuan.</p>
              {summary.byKind.map((k) => <button type="button" className="dash-v2-row" key={k.kind} onClick={() => onNavigate('health')}><b>{k.count}</b> {KIND_LABEL[k.kind]} <span>›</span></button>)}
              {top ? <button type="button" className="dash-v2-row" onClick={() => onOpenEntry(top.id)}>Prioritas: {summary.headline}<span>›</span></button> : null}
            </>
          ) : <p className="dash-v2-explain">Tidak ada masalah yang terdeteksi pada {list.length} entri.</p>}
        </section>
        <section className="card dash-v2-panel">
          <div className="dash-v2-panel-head"><h2>Cadangan</h2><button type="button" className="linkish" onClick={() => onNavigate('backup')}>Buka cadangan ›</button></div>
          <button type="button" className="dash-v2-row" onClick={() => onNavigate('backup')}>
            {lastBackup ? `Cadangan terakhir ${relativeTime(lastBackup)}` : 'Belum ada cadangan'}<span>›</span>
          </button>
          <button type="button" className="dash-v2-row" onClick={() => onNavigate('settings')}>
            {hasRecoveryWrap ? 'Kunci pemulihan aktif' : 'Kunci pemulihan belum dibuat'}<span>›</span>
          </button>
          <p className="dash-v2-explain">{vault.settings.autoBackup === 'off' ? 'Cadangan otomatis mati' : `${backups.length} cadangan tersimpan di perangkat ini`}</p>
        </section>
      </div>

      <section className="dash-v2-helper">
        <span className={`dot ${helperOnline && helperAccessibility ? 'on' : 'warn'}`} aria-hidden="true" />
        <span>{helperOnline ? (helperAccessibility ? 'Isi otomatis aplikasi Mac aktif' : 'Helper Mac perlu izin Aksesibilitas') : 'Helper Mac tidak terhubung'}</span>
        <button type="button" className="linkish" onClick={() => onNavigate('autofill')}>Lihat pengaturan</button>
        <span className="muted">{lockMinutes > 0 ? `Kunci otomatis ${lockMinutes} menit` : 'Kunci otomatis mati'} · {withOtp} entri dengan OTP</span>
      </section>

      <section className="dash-section">
        <div className="split">
          <h3>Terbaru</h3>
          <button type="button" className="linkish" onClick={onOpenVault}>
            Semua entri ›
          </button>
        </div>
        {recent.length === 0 ? (
          <p className="muted">Belum ada entri. Generator bisa bikin sandi baru, lalu simpan di brankas.</p>
        ) : (
          <div className="recent-grid">
            {recent.map((e) => {
              const where = hostFromUrl(e.url || e.urls[0] || '') || e.appName || 'Tanpa situs'
              return (
                <div key={e.id} className="card recent-card">
                  <div className="recent-h">
                    <EntryGlyph entry={e} />
                    <div>
                      <strong>{e.name || 'Tanpa nama'}</strong>
                      <small>
                        {e.lastUsedAt ? `Dipakai ${relativeTime(e.lastUsedAt)}` : `Diubah ${relativeTime(e.updatedAt)}`}
                      </small>
                    </div>
                  </div>
                  <p className="muted">
                    {where}
                    {e.totpSecret ? ' · kode OTP tersimpan' : ''}
                  </p>
                  <div className="recent-acts">
                    {e.password ? (
                      <button
                        type="button"
                        className="icon-btn"
                        title="Salin sandi"
                        aria-label={`Salin sandi ${e.name}`}
                        onClick={() => void copySecret('Sandi', e.password!)}
                      >
                        <IconCopy size={16} />
                      </button>
                    ) : (
                      <span />
                    )}
                    <button type="button" className="linkish" onClick={() => onOpenEntry(e.id)}>
                      Buka ›
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="card dash-dupes">
        <div>
          <h3>Rekomendasi duplikat</h3>
          <p className="muted">
            Situs yang sama (agoda.com vs www.agoda.com), nama mirip, atau login dobel. Gabungkan, atau buang yang tidak
            dipakai.
          </p>
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
                    <span className={`sev ${c.passwordConflict ? 'sev-hi' : 'sev-info'}`}>
                      {c.suggestion === 'merge' ? 'Bisa digabung' : 'Cek dulu'}
                    </span>
                  </header>
                  <p className="muted">{c.detail}</p>
                  {c.passwordConflict ? (
                    <p className="warn-text">Password-nya beda. Pilih mana yang disimpan, atau buang yang salah.</p>
                  ) : null}
                  <ul className="dupe-members">
                    {c.members.map((m) => (
                      <li key={m.id} className={keepId === m.id ? 'dupe-member on' : 'dupe-member'}>
                        {/* The radio and the open-entry button are siblings, not
                            nested: a button inside a <label> would toggle the
                            radio every time the user tried to open the entry. */}
                        <input
                          type="radio"
                          name={`keep-${c.id}`}
                          checked={keepId === m.id}
                          onChange={() => setKeepByCluster((prev) => ({ ...prev, [c.id]: m.id }))}
                          aria-label={`Simpan ${m.name}`}
                        />
                        <button type="button" className="linkish" onClick={() => onOpenEntry(m.id)}>
                          {m.name}
                        </button>
                        <em>
                          {m.host || 'tanpa situs'} · {maskAccount(m.username)}
                        </em>
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
    </div>
  )
}
