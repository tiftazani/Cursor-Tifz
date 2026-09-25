import { useState } from 'react'
import { analyzeHealth, summarizeIssues, type HealthIssue, type IssueKind } from '../lib/health'
import { pwnedCount } from '../lib/hibp'
import { useVault } from '../state/VaultContext'
import { IconShield } from '../components/Icons'

const KIND_TEXT: Record<IssueKind, { tag: string; title: string; body: string }> = {
  pwned: { tag: 'Bocor', title: 'Sandi muncul di kebocoran publik', body: 'Ganti di situsnya dulu, lalu simpan di Kunci.' },
  reused: {
    tag: 'Dipakai ulang',
    title: 'Entri memakai sandi yang sama',
    body: 'Kalau satu situs bocor, situs lain ikut terbuka.',
  },
  weak: { tag: 'Lemah', title: 'Sandi lemah', body: 'Mudah ditebak. Generator bisa membuat penggantinya.' },
  short: { tag: 'Pendek', title: 'Sandi di bawah 10 karakter', body: 'Makin pendek, makin cepat ditebak.' },
  old: { tag: 'Saran', title: 'Lebih dari 1 tahun tidak diganti', body: 'Ganti kalau situsnya penting.' },
}

export function HealthView({ onOpen }: { onOpen: (id: string) => void }) {
  const { vault } = useVault()
  const [pwned, setPwned] = useState<{ id: string; count: number }[] | null>(null)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'sum' | 'list'>('sum')
  if (!vault) return null
  const report = analyzeHealth(vault.entries)
  // Breach hits are only known after a check in this session; they join the same
  // issue list so every count on the page comes from one source.
  const breachIssues: HealthIssue[] = (pwned ?? []).map((p) => ({
    id: `${p.id}-pwned`,
    entryId: p.id,
    entryName: vault.entries.find((e) => e.id === p.id)?.name ?? p.id,
    kind: 'pwned',
    detail: `Terlihat ${p.count.toLocaleString('id-ID')} kali di data kebocoran`,
  }))
  const issues = [...breachIssues, ...report.issues]
  const summary = summarizeIssues(issues)
  const withPassword = vault.entries.filter((e) => e.password).length

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

  const breachCard = (
    <section className={`card prio ${pwned === null ? 'prio-idle' : pwned.length === 0 ? 'prio-ok' : ''}`}>
      <div className="prio-h">
        <span className="prio-i">
          <IconShield size={20} />
        </span>
        <div>
          <h3>
            {pwned === null
              ? 'Cek kebocoran belum dijalankan'
              : pwned.length === 0
                ? 'Tidak ada sandi yang ditemukan di kebocoran'
                : `${pwned.length} sandi muncul di kebocoran publik`}
          </h3>
          <p>
            {pwned && pwned.length > 0
              ? 'Ganti di situsnya dulu, lalu simpan sandi baru di Kunci.'
              : 'Hanya 5 karakter awal hash SHA-1 yang dikirim ke Have I Been Pwned. Sandi utuh tidak keluar dari perangkat.'}
          </p>
        </div>
      </div>
      <div className="prio-b">
        <span className="muted small">
          {vault.settings.hibpEnabled ? `${withPassword} entri punya sandi` : 'Cek kebocoran dimatikan di Pengaturan'}
        </span>
        {pwned && pwned.length > 0 ? (
          <button type="button" className="btn btn-primary" onClick={() => onOpen(pwned[0].id)}>
            Buka entri {breachIssues[0].entryName}
          </button>
        ) : (
          <button
            type="button"
            className={pwned === null ? 'btn btn-primary' : 'btn'}
            onClick={() => void checkBreaches()}
            disabled={checking || !vault.settings.hibpEnabled}
          >
            {checking ? 'Memeriksa…' : pwned === null ? 'Cek kebocoran' : 'Cek ulang'}
          </button>
        )}
      </div>
      {error ? <p className="error prio-err">{error}</p> : null}
    </section>
  )

  const habits = summary.byKind.filter((k) => k.kind !== 'pwned')

  return (
    <div className="page health">
      <header className="page-head">
        <h2>Kesehatan</h2>
        <p className="muted">Dihitung di perangkat ini. Server hanya menyimpan brankas terenkripsi.</p>
      </header>

      <div className="tabs" role="tablist" aria-label="Tampilan kesehatan">
        <button type="button" role="tab" aria-selected={tab === 'sum'} className="tab" onClick={() => setTab('sum')}>
          Ringkasan
        </button>
        <button type="button" role="tab" aria-selected={tab === 'list'} className="tab" onClick={() => setTab('list')}>
          Semua masalah <span className="muted">({summary.total})</span>
        </button>
      </div>

      {tab === 'sum' ? (
        <>
          {breachCard}
          <div className="split sec-h">
            <h3>Kebiasaan sandi</h3>
            <span className="muted small">
              {summary.total} masalah di {summary.entries} entri
            </span>
          </div>
          {habits.length === 0 ? (
            <p className="ok">Tidak ada sandi lemah, pendek, usang, atau dipakai ulang.</p>
          ) : (
            <div className="usage-grid">
              {habits.map((k) => {
                const t = KIND_TEXT[k.kind]
                return (
                  <section key={k.kind} className="card usage-card">
                    <span className={`sev sev-${k.tone}`}>{t.tag}</span>
                    <strong className="big">{k.count}</strong>
                    <h4>{t.title}</h4>
                    <p className="muted">{t.body}</p>
                    <div className="usage-foot">
                      <button type="button" className="linkish" onClick={() => setTab('list')}>
                        Lihat {k.count} entri ›
                      </button>
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </>
      ) : issues.length === 0 ? (
        <p className="ok">Tidak ada masalah yang terdeteksi.</p>
      ) : (
        <section className="card">
          <ul className="issue-list">
            {issues.map((i) => (
              <li key={i.id}>
                <button type="button" className="linkish" onClick={() => onOpen(i.entryId)}>
                  {i.entryName || 'Tanpa nama'}
                </button>
                <span className={`sev sev-${summary.byKind.find((k) => k.kind === i.kind)?.tone ?? 'info'}`}>
                  {KIND_TEXT[i.kind].tag}
                </span>
                <span className="muted">{i.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
