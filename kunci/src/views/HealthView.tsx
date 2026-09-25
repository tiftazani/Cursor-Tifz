import { useEffect, useState } from 'react'
import { analyzeHealth, sortHealthIssues, summarizeIssues, type HealthIssue, type IssueKind } from '../lib/health'
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
  insecure: { tag: 'HTTP', title: 'Situs tanpa HTTPS', body: 'Periksa alamat dan pakai HTTPS bila tersedia.' },
  duplicate: { tag: 'Duplikat', title: 'Kemungkinan entri ganda', body: 'Periksa sebelum menggabungkan atau menghapus.' },
}

export function HealthView({ onOpen }: { onOpen: (id: string) => void }) {
  const { vault } = useVault()
  const [pwned, setPwned] = useState<{ id: string; count: number }[] | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkedAt, setCheckedAt] = useState<number | null>(null)
  const [checkedSignature, setCheckedSignature] = useState('')
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'sum' | 'list'>('sum')
  const [kindFilter, setKindFilter] = useState<IssueKind | null>(null)
  // Track revisions, never keep plaintext passwords in React state for cache invalidation.
  const signature = (vault?.entries ?? []).filter((e) => (e.type === 'login' || e.type === 'app') && e.password)
    .map((e) => `${e.id}:${e.updatedAt}:${e.passwordChangedAt ?? ''}`).join('\u0000')
  useEffect(() => {
    if (checkedSignature !== signature || !vault?.settings.hibpEnabled) {
      setPwned(null)
      setCheckedAt(null)
    }
  }, [signature, checkedSignature, vault?.settings.hibpEnabled])
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
  const issues = sortHealthIssues([...(checkedAt && checkedSignature === signature && vault.settings.hibpEnabled ? breachIssues : []), ...report.issues], vault.entries)
  const summary = summarizeIssues(issues)
  const visibleIssues = kindFilter ? issues.filter((issue) => issue.kind === kindFilter) : issues
  const withPassword = vault.entries.filter((e) => e.password && (e.type === 'login' || e.type === 'app')).length
  const checked = checkedAt !== null && checkedSignature === signature && vault.settings.hibpEnabled
  function showKind(kind: IssueKind) {
    setKindFilter(kind)
    setTab('list')
  }

  async function checkBreaches() {
    if (!vault?.settings.hibpEnabled) return
    setChecking(true)
    setError('')
    try {
      const found: { id: string; count: number }[] = []
      for (const e of vault.entries) {
        if (!e.password || (e.type !== 'login' && e.type !== 'app')) continue
        const count = await pwnedCount(e.password)
        if (count > 0) found.push({ id: e.id, count })
      }
      setPwned(found)
      setCheckedSignature(signature)
      setCheckedAt(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal cek kebocoran')
    } finally {
      setChecking(false)
    }
  }

  const breachCard = (
    <section className={`card prio ${!checked ? 'prio-idle' : pwned?.length === 0 ? 'prio-ok' : ''}`}>
      <div className="prio-h">
        <span className="prio-i">
          <IconShield size={20} />
        </span>
        <div>
          <h3>
            {!checked
              ? 'Kebocoran belum diperiksa'
              : pwned?.length === 0
                ? 'Tidak ada sandi yang ditemukan di kebocoran'
                : `${pwned?.length ?? 0} sandi muncul di kebocoran publik`}
          </h3>
          <p>
            {checked && pwned && pwned.length > 0
              ? 'Ganti di situsnya dulu, lalu simpan sandi baru di Kunci.'
              : 'Hanya 5 karakter awal hash SHA-1 yang dikirim ke Have I Been Pwned. Sandi utuh tidak keluar dari perangkat.'}
          </p>
        </div>
      </div>
      <div className="prio-b">
        <span className="muted small">
          {vault.settings.hibpEnabled
            ? `${withPassword} entri punya sandi · ${checked && checkedAt ? `Terakhir diperiksa ${new Date(checkedAt).toLocaleString('id-ID')}` : 'Belum diperiksa'}`
            : 'Cek kebocoran nonaktif di Pengaturan · Belum diperiksa'}
        </span>
        {checked && pwned && pwned.length > 0 ? (
          <button type="button" className="btn btn-primary" onClick={() => onOpen(pwned[0].id)}>
            Buka entri {breachIssues[0].entryName}
          </button>
        ) : (
          <button
            type="button"
            className={!checked ? 'btn btn-primary' : 'btn'}
            onClick={() => void checkBreaches()}
            disabled={checking || !vault.settings.hibpEnabled}
          >
            {checking ? 'Memeriksa…' : !checked ? 'Cek kebocoran' : 'Cek ulang'}
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
        <button type="button" role="tab" aria-selected={tab === 'list'} className="tab" onClick={() => { setKindFilter(null); setTab('list') }}>
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
                      <button type="button" className="linkish" onClick={() => showKind(k.kind)}>
                        Lihat {k.count} masalah ›
                      </button>
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </>
      ) : (
        <section className="card">
          {kindFilter ? <div className="split"><h3>{KIND_TEXT[kindFilter].title} ({visibleIssues.length})</h3><button type="button" className="linkish" onClick={() => setKindFilter(null)}>Lihat semua masalah</button></div> : null}
          {visibleIssues.length === 0 ? <p className="muted">Tidak ada masalah yang terdeteksi untuk filter ini.</p> : <ul className="issue-list">
            {visibleIssues.map((i) => (
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
          </ul>}
        </section>
      )}
    </div>
  )
}
