import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { AppView, Entry, FilterId } from '../types'
import {
  IconClock,
  IconDownload,
  IconFill,
  IconHome,
  IconKey,
  IconLock,
  IconMore,
  IconPlus,
  IconSearch,
  IconSettings,
  IconShield,
  IconSpark,
  IconStar,
} from '../components/Icons'
import { VSplit } from '../components/VSplit'
import { searchEntries } from '../lib/search'
import { useCompactLayout } from '../lib/media'
import { hostFromUrl } from '../lib/match'
import { analyzeHealth } from '../lib/health'
import { EntryGlyph } from '../components/EntryGlyph'
import {
  LIST_MAX,
  LIST_MIN,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
  loadSplit,
  saveSplit,
  type SplitWidths,
} from '../lib/split'
import { blankEntry, useVault } from '../state/VaultContext'
import { EntryPane } from './EntryPane'
import { DashboardView } from './DashboardView'
import { GeneratorView } from './GeneratorView'
import { HealthView } from './HealthView'
import { HistoryView } from './HistoryView'
import { AutofillView } from './AutofillView'
import { BackupView } from './BackupView'
import { SettingsView } from './SettingsView'
import { QuickFind } from './QuickFind'

// `group` starts a labelled block in the desktop sidebar; the mobile tab bar
// ignores it.
const NAV: { id: AppView; label: string; icon: typeof IconKey; group?: string }[] = [
  { id: 'home', label: 'Ringkasan', icon: IconHome },
  { id: 'vault', label: 'Brankas', icon: IconKey },
  { id: 'health', label: 'Kesehatan', icon: IconShield },
  { id: 'generator', label: 'Generator', icon: IconSpark },
  { id: 'history', label: 'Riwayat', icon: IconClock },
  { id: 'autofill', label: 'Isi otomatis', icon: IconFill, group: 'Perangkat dan data' },
  { id: 'backup', label: 'Cadangan', icon: IconDownload },
  { id: 'settings', label: 'Pengaturan', icon: IconSettings },
]

const MORE_NAV = new Set<AppView>(['history', 'autofill', 'backup', 'settings'])

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'Semua' },
  { id: 'favorite', label: 'Favorit' },
  { id: 'login', label: 'Website' },
  { id: 'app', label: 'Aplikasi' },
  { id: 'password', label: 'Password' },
  { id: 'note', label: 'Catatan' },
  { id: 'totp', label: 'OTP' },
  { id: 'trash', label: 'Sampah' },
]

export function AppShell() {
  const { vault, lock, helperOnline, helperAccessibility, emptyTrash } = useVault()
  const compact = useCompactLayout()
  const [view, setView] = useState<AppView>('home')
  const [filter, setFilter] = useState<FilterId>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'recent' | 'name'>('recent')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Entry | null>(null)
  const [draftDirty, setDraftDirty] = useState(false)
  // Bumped only when we deliberately drop the pane's local draft. It must NOT be
  // derived from `draftDirty`: keying on that remounted the pane the instant the
  // first keystroke flipped it, so every edit was destroyed as it was typed.
  const [paneEpoch, setPaneEpoch] = useState(0)
  const [findOpen, setFindOpen] = useState(false)
  const [mobileDetail, setMobileDetail] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [split, setSplit] = useState<SplitWidths>(() => loadSplit())

  useEffect(() => {
    saveSplit(split)
  }, [split])

  const source = useMemo(
    () => (filter === 'trash' ? (vault?.trash ?? []) : (vault?.entries ?? [])),
    [filter, vault],
  )
  const filtered = useMemo(() => {
    let list = source
    if (filter === 'favorite') list = list.filter((e) => e.favorite)
    else if (filter !== 'all' && filter !== 'trash') list = list.filter((e) => e.type === filter)
    return searchEntries(list, query).sort((a, b) => sort === 'name'
      ? a.name.localeCompare(b.name, 'id') || a.id.localeCompare(b.id)
      : b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
  }, [source, filter, query, sort])

  const selected = draft ?? filtered.find((e) => e.id === selectedId) ?? (draftDirty ? source.find((e) => e.id === selectedId) : undefined) ?? null
  // Same source as the Kesehatan page and the Ringkasan card, so the badge and
  // the counts on those pages never disagree.
  const issueCount = useMemo(() => analyzeHealth(vault?.entries ?? []).issues.length, [vault?.entries])

  // The keydown listener registers once (deps `[lock]`), so it would keep calling
  // the `startNew` captured on that first render — where `draftDirty` was still
  // false, so the discard guard waved every unsaved edit through. Assign the ref
  // in an effect, which runs before any key can be pressed.
  const startNewRef = useRef(startNew)
  useEffect(() => {
    startNewRef.current = startNew
  })

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setFindOpen(true)
      }
      if (meta && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        startNewRef.current()
      }
      if (meta && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        lock()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lock])

  function goView(next: AppView) {
    // Leaving the vault view unmounts the pane, which is where the unsaved edits
    // live. Ask first.
    if (next !== 'vault' && !confirmDiscard('pindah halaman')) return
    setView(next)
    setMoreOpen(false)
    if (next === 'vault') setMobileDetail(false)
  }

  /** One place to ask before an action would drop edits the user has not saved. */
  function confirmDiscard(what: string): boolean {
    if (!draftDirty) return true
    if (!window.confirm(`Ada suntingan yang belum disimpan. Buang dan ${what}?`)) return false
    // They agreed to lose the edits, so force the pane to reload from the vault
    // rather than leaving its local copy of the discarded text on screen.
    setPaneEpoch((e) => e + 1)
    return true
  }

  function startNew() {
    if (!confirmDiscard('mulai entri baru')) return
    const entry = blankEntry('login')
    setDraft(entry)
    setDraftDirty(false)
    setSelectedId(entry.id)
    setView('vault')
    setFilter('all')
    setMobileDetail(true)
    setMoreOpen(false)
  }

  function openEntry(id: string) {
    if (!confirmDiscard('buka entri lain')) return
    setDraft(null)
    setDraftDirty(false)
    setSelectedId(id)
    setView('vault')
    setFilter('all')
    setMobileDetail(true)
    setMoreOpen(false)
  }

  function backToList() {
    // The only exit from the detail pane in the compact layout, so it needs the
    // same guard as every other door.
    if (!confirmDiscard('kembali ke daftar')) return
    setMobileDetail(false)
    setDraft(null)
    setDraftDirty(false)
  }

  const shellClass = [
    'shell',
    view === 'vault' ? 'shell-vault' : 'shell-page',
    view === 'vault' && mobileDetail ? 'mobile-detail' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={shellClass}
      style={
        compact
          ? undefined
          : ({
              '--sidebar': `${split.sidebar}px`,
              '--list': `${split.list}px`,
            } as CSSProperties)
      }
    >
      <aside className="sidebar">
        <div className="brand brand-side">
          <span className="brand-mark sm">
            <IconKey size={18} />
          </span>
          <div>
            <strong>Kunci</strong>
            <span className="muted">Brankas pribadi · {__KUNCI_VERSION__}</span>
          </div>
        </div>
        <nav>
          {NAV.map((item) => {
            const Icon = item.icon
            const hiddenInBar = MORE_NAV.has(item.id)
            return (
              <Fragment key={item.id}>
                {item.group ? <p className="nav-group">{item.group}</p> : null}
                <button
                  type="button"
                  className={`nav-item ${view === item.id ? 'active' : ''} ${hiddenInBar ? 'nav-secondary' : ''}`}
                  aria-current={view === item.id ? 'page' : undefined}
                  onClick={() => goView(item.id)}
                >
                  <Icon size={compact ? 22 : 18} />
                  <span>{item.label}</span>
                  {item.id === 'health' && issueCount > 0 ? (
                    <b className="nav-badge" aria-label={`${issueCount} masalah`}>
                      {issueCount}
                    </b>
                  ) : null}
                </button>
              </Fragment>
            )
          })}
          <button
            type="button"
            className={`nav-item nav-more-btn ${MORE_NAV.has(view) || moreOpen ? 'active' : ''}`}
            onClick={() => setMoreOpen((open) => !open)}
          >
            <IconMore size={22} />
            <span>Lainnya</span>
          </button>
        </nav>
        <div className="sidebar-foot">
          <button type="button" className="helper-chip" onClick={() => goView('autofill')} title="Pengaturan isi otomatis">
            <span className={`dot ${helperOnline ? 'on' : ''}`} />
            {helperOnline ? (helperAccessibility ? 'Helper Mac' : 'Helper · izinkan AX') : 'Helper off'}
          </button>
          <button type="button" className="icon-btn" title="Kunci (⌘L)" onClick={lock}>
            <IconLock size={16} />
          </button>
        </div>
        {moreOpen ? (
          <div className="more-back" onClick={() => setMoreOpen(false)}>
            <div className="more-sheet" onClick={(e) => e.stopPropagation()}>
              <p className="more-sheet-title">Lainnya</p>
              {NAV.filter((item) => MORE_NAV.has(item.id)).map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`nav-item ${view === item.id ? 'active' : ''}`}
                    onClick={() => goView(item.id)}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </button>
                )
              })}
              <button type="button" className="nav-item" onClick={() => lock()}>
                <IconLock size={20} />
                <span>Kunci brankas</span>
              </button>
            </div>
          </div>
        ) : null}
      </aside>

      {compact ? null : (
        <VSplit
          value={split.sidebar}
          min={SIDEBAR_MIN}
          max={SIDEBAR_MAX}
          label="Lebar menu"
          onChange={(sidebar) => setSplit((s) => ({ ...s, sidebar }))}
        />
      )}

      {view === 'vault' ? (
        <>
          {!compact || !mobileDetail ? (
          <section className="list-col">
            <div className="list-toolbar">
              <div className="search">
                <IconSearch size={16} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari nama/situs…"
                  enterKeyHint="search"
                  aria-label="Cari nama, situs, atau username"
                />
              </div>
              <button type="button" className="icon-btn toolbar-lock" title="Kunci brankas" onClick={lock}>
                <IconLock size={18} />
              </button>
              {filter === 'trash' ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    if (window.confirm('Hapus semua entri di sampah secara permanen?')) void emptyTrash()
                  }}
                >
                  Kosongkan
                </button>
              ) : (
                <button type="button" className="btn btn-primary toolbar-new" onClick={startNew}>
                  <IconPlus size={16} /> Baru
                </button>
              )}
            </div>
            <div className="vault-list-controls">
              <span aria-live="polite">{filtered.length} dari {source.length} entri</span>
              <label>
                Urutkan
                <select className="vault-sort" value={sort} onChange={(e) => setSort(e.target.value as 'recent' | 'name')}>
                  <option value="recent">Terakhir diubah</option>
                  <option value="name">Nama A–Z</option>
                </select>
              </label>
            </div>
            <div className="filter-row" aria-label="Filter jenis entri">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`chip ${filter === f.id ? 'active' : ''}`}
                  onClick={() => {
                    // Do not throw away unsaved edits. Switching a chip used to
                    // remount the pane and the local draft died with it.
                    if (!confirmDiscard('pindah filter')) return
                    setFilter(f.id)
                    setDraft(null)
                    setDraftDirty(false)
                    setMobileDetail(false)
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <ul className="entry-list" aria-label="Daftar entri" onKeyDown={(e) => {
              if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
              const rows = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('.entry-row'))
              const current = rows.indexOf(document.activeElement as HTMLButtonElement)
              const next = rows[current + (e.key === 'ArrowDown' ? 1 : -1)]
              if (next) { e.preventDefault(); next.focus() }
            }}>
              {filtered.length === 0 ? (
                <li className="empty-hero">
                  {query ? (
                    <>
                      <strong>Tidak ada yang cocok</strong>
                      <span>Coba nama situs, username, atau tag lain.</span>
                    </>
                  ) : filter === 'trash' ? (
                    <>
                      <strong>Sampah kosong</strong>
                      <span>Entri yang dibuang akan muncul di sini.</span>
                    </>
                  ) : (
                    <>
                      <strong>Brankas masih kosong</strong>
                      <span>Simpan login website atau aplikasi Mac. Isi ke browser lewat ekstensi, ke app lewat helper.</span>
                      <button type="button" className="btn btn-primary" onClick={startNew}>
                        <IconPlus size={16} /> Entri pertama
                      </button>
                    </>
                  )}
                </li>
              ) : (
                filtered.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      className={`entry-row ${selected?.id === e.id ? 'active' : ''}`}
                      aria-current={selected?.id === e.id ? 'true' : undefined}
                      onClick={() => {
                        // Same guard as the filter chips: a remount here would drop
                        // the unsaved draft. `setDraft(null)` only clears the
                        // never-saved entry, which has no vault copy to fall back to.
                        if (draftDirty && !window.confirm('Ada suntingan yang belum disimpan. Buang dan buka entri lain?')) return
                        setDraft(null)
                        setDraftDirty(false)
                        setSelectedId(e.id)
                        setMobileDetail(true)
                      }}
                    >
                      <EntryGlyph entry={e} />
                      <span>
                        <strong>
                          {e.name}{e.favorite ? <span className="favorite-mark" aria-label="Favorit"><IconStar size={12} /></span> : null}
                        </strong>
                        <em>{entryListHint(e)}</em>
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
            {filter !== 'trash' ? (
              <button type="button" className="fab-new" onClick={startNew} aria-label="Entri baru">
                <IconPlus size={22} />
              </button>
            ) : null}
          </section>
          ) : null}
          {compact ? null : (
            <VSplit
              value={split.list}
              min={LIST_MIN}
              max={LIST_MAX}
              label="Lebar daftar"
              onChange={(list) => setSplit((s) => ({ ...s, list }))}
            />
          )}
          {!compact || mobileDetail ? (
          <section className="detail-col">
            {selected ? (
              <EntryPane
                key={`${selected.id}-${selected.updatedAt}-${paneEpoch}`}
                entry={selected}
                isNew={Boolean(draft && draft.id === selected.id)}
                inTrash={filter === 'trash'}
                onCloseNew={startNew}
                onBack={backToList}
                onDirtyChange={setDraftDirty}
              />
            ) : (
              <div className="empty tall empty-hero">
                <strong>Pilih entri</strong>
                <span>Atau buat yang baru untuk menyimpan nama pengguna dan kata sandi.</span>
                <button type="button" className="btn btn-primary" onClick={startNew}>
                  <IconPlus size={16} /> Entri baru
                </button>
              </div>
            )}
          </section>
          ) : null}
        </>
      ) : (
        <section className="main-col">
          {view === 'home' ? (
            <DashboardView
              onOpenVault={() => goView('vault')}
              onOpenEntry={openEntry}
              onNavigate={goView}
            />
          ) : null}
          {view === 'generator' ? <GeneratorView /> : null}
          {view === 'health' ? <HealthView onOpen={openEntry} /> : null}
          {view === 'history' ? <HistoryView onOpen={openEntry} /> : null}
          {view === 'autofill' ? <AutofillView /> : null}
          {view === 'backup' ? <BackupView /> : null}
          {view === 'settings' ? <SettingsView /> : null}
        </section>
      )}

      {findOpen ? (
        <QuickFind
          entries={vault?.entries ?? []}
          onClose={() => setFindOpen(false)}
          onSelect={(id) => {
            openEntry(id)
            setFindOpen(false)
          }}
          onAction={(action) => {
            if (action === 'new') startNew()
            if (action === 'lock') lock()
            if (action === 'generator') goView('generator')
            setFindOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}

function entryListHint(entry: Entry): string {
  const url = entry.url || entry.urls[0] || ''
  const host = hostFromUrl(url)
  if (host) return host
  if (entry.appName) return entry.appName
  if (entry.type === 'login') return 'Website'
  if (entry.type === 'app') return 'Aplikasi'
  if (entry.type === 'note') return 'Catatan'
  if (entry.type === 'totp') return 'OTP'
  return 'Password'
}
