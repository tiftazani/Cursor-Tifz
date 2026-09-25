import { useMemo, useState } from 'react'
import { analyzeHealth, summarizeIssues, type IssueKind } from '../lib/health'
import { findDuplicateClusters, maskAccount } from '../lib/duplicates'
import { relativeTime } from '../lib/time'
import { hostFromUrl } from '../lib/match'
import { useVault } from '../state/VaultContext'
import { useToast } from '../components/Toast'
import { EntryGlyph } from '../components/EntryGlyph'
import { IconCheck, IconCopy, IconShield } from '../components/Icons'
import type { AppView } from '../types'

const KIND_LABEL: Record<IssueKind, string> = {
  reused: 'dipakai ulang',
  weak: 'lemah',
  short: 'pendek',
  old: 'usang',
  pwned: 'bocor',
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
      <header className="page-head">
        <h2>Ringkasan</h2>
        <p className="muted">
          {lockMinutes > 0 ? `Kunci otomatis aktif: ${lockMinutes} menit tanpa aktivitas` : 'Kunci otomatis mati'}
        </p>
      </header>

      {summary.total > 0 && top ? (
        <section className="card prio">
          <div className="prio-h">
            <span className="prio-i">
              <IconShield size={20} />
            </span>
            <div>
              <h3>{summary.headline}</h3>
              <p>{summary.advice}</p>
            </div>
          </div>
          <div className="prio-b">
            <div className="sev-row" role="group" aria-label="Lihat per jenis masalah">
              <span className="muted sev-lead">{summary.entries} entri terdampak:</span>
              {summary.byKind.map((k) => (
                <button key={k.kind} type="button" className={`sev sev-${k.tone}`} onClick={() => onNavigate('health')}>
                  {k.count} {KIND_LABEL[k.kind]}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-primary" onClick={() => onOpenEntry(top.id)}>
              Buka entri {top.name || 'ini'}
            </button>
          </div>
        </section>
      ) : (
        <section className="card prio prio-ok">
          <div className="prio-h">
            <span className="prio-i">
              <IconCheck size={20} />
            </span>
            <div>
              <h3>Tidak ada masalah sandi yang terdeteksi</h3>
              <p>Dihitung di perangkat ini dari {list.length} entri.</p>
            </div>
          </div>
        </section>
      )}

      <div className="card stat-strip">
        <button type="button" onClick={onOpenVault}>
          <strong>{list.length}</strong>
          <span>Entri aktif</span>
        </button>
        <div>
          <strong>{favorites}</strong>
          <span>Favorit</span>
        </div>
        <div>
          <strong>{withOtp}</strong>
          <span>Punya kode OTP</span>
        </div>
        <div>
          <strong>{vault.trash.length}</strong>
          <span>Di sampah</span>
        </div>
      </div>

      <div className="dash-grid">
        <section className="card status-card">
          <div className="split">
            <h3>Isi otomatis</h3>
            <button type="button" className="linkish" onClick={() => onNavigate('autofill')}>
              Atur ›
            </button>
          </div>
          <div className="status-row">
            <span className={`dot ${helperOnline && helperAccessibility ? 'on' : 'warn'}`} aria-hidden="true" />
            <span className="grow">
              {helperOnline ? (helperAccessibility ? 'Helper Mac aktif' : 'Helper Mac belum diizinkan') : 'Helper Mac mati'}
              <small>
                {helperOnline
                  ? helperAccessibility
                    ? 'Bisa mengisi login di aplikasi Mac'
                    : 'Izinkan Aksesibilitas agar bisa mengisi aplikasi Mac'
                  : 'Isi di aplikasi Mac tidak tersedia. Ekstensi browser tetap jalan.'}
              </small>
            </span>
          </div>
        </section>

        <section className="card status-card">
          <div className="split">
            <h3>Cadangan</h3>
            <button type="button" className="linkish" onClick={() => onNavigate('backup')}>
              Atur ›
            </button>
          </div>
          <div className="status-row">
            <span className={`dot ${lastBackup ? 'on' : 'warn'}`} aria-hidden="true" />
            <span className="grow">
              {lastBackup ? `Cadangan terakhir ${relativeTime(lastBackup)}` : 'Belum ada cadangan'}
              <small>
                {vault.settings.autoBackup === 'off' ? 'Cadangan otomatis mati' : `${backups.length} tersimpan di perangkat ini`}
              </small>
            </span>
          </div>
          <div className="status-row">
            <span className={`dot ${hasRecoveryWrap ? 'on' : 'warn'}`} aria-hidden="true" />
            <span className="grow">
              {hasRecoveryWrap ? 'Kunci pemulihan aktif' : 'Kunci pemulihan belum dibuat'}
              <small>
                {hasRecoveryWrap
                  ? 'Simpan di tempat aman. Tanpa itu, lupa sandi induk berarti brankas tidak bisa dibuka.'
                  : 'Tanpa kunci pemulihan, lupa sandi induk berarti brankas tidak bisa dibuka.'}
              </small>
            </span>
          </div>
        </section>
      </div>

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
