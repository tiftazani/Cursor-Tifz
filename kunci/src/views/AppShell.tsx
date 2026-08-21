import { useEffect, useMemo, useState } from 'react'
import type { AppView, Entry, FilterId } from '../types'
import {
  IconApp,
  IconClock,
  IconDownload,
  IconFill,
  IconGlobe,
  IconKey,
  IconLock,
  IconMore,
  IconNote,
  IconOtp,
  IconPlus,
  IconSearch,
  IconSettings,
  IconShield,
  IconSpark,
  IconStar,
} from '../components/Icons'
import { searchEntries } from '../lib/search'
import { faviconUrl, letterAvatar } from '../lib/favicon'
import { COMPACT_NAV_QUERY, PHONE_QUERY, useMediaQuery } from '../lib/media'
import { blankEntry, useVault } from '../state/VaultContext'
import { EntryPane } from './EntryPane'
import { GeneratorView } from './GeneratorView'
import { HealthView } from './HealthView'
import { HistoryView } from './HistoryView'
import { AutofillView } from './AutofillView'
import { BackupView } from './BackupView'
import { SettingsView } from './SettingsView'
import { QuickFind } from './QuickFind'

const NAV: { id: AppView; label: string; icon: typeof IconKey }[] = [
  { id: 'vault', label: 'Brankas', icon: IconKey },
  { id: 'generator', label: 'Generator', icon: IconSpark },
  { id: 'health', label: 'Kesehatan', icon: IconShield },
  { id: 'history', label: 'Riwayat', icon: IconClock },
  { id: 'autofill', label: 'Autofill', icon: IconFill },
  { id: 'backup', label: 'Cadangan', icon: IconDownload },
  { id: 'settings', label: 'Pengaturan', icon: IconSettings },
]

const MORE_NAV = new Set<AppView>(['history', 'backup', 'settings'])

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
  const { vault, lock, helperOnline, emptyTrash } = useVault()
  const isPhone = useMediaQuery(PHONE_QUERY)
  const compactNav = useMediaQuery(COMPACT_NAV_QUERY)
  const [view, setView] = useState<AppView>('vault')
  const [filter, setFilter] = useState<FilterId>('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Entry | null>(null)
  const [findOpen, setFindOpen] = useState(false)
  const [mobileDetail, setMobileDetail] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  const source = useMemo(
    () => (filter === 'trash' ? (vault?.trash ?? []) : (vault?.entries ?? [])),
    [filter, vault],
  )
  const filtered = useMemo(() => {
    let list = source
    if (filter === 'favorite') list = list.filter((e) => e.favorite)
    else if (filter !== 'all' && filter !== 'trash') list = list.filter((e) => e.type === filter)
    return searchEntries(list, query).sort((a, b) => b.updatedAt - a.updatedAt)
  }, [source, filter, query])

  const selected = draft ?? filtered.find((e) => e.id === selectedId) ?? (!isPhone ? filtered[0] : null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setFindOpen(true)
      }
      if (meta && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        startNew()
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
    setView(next)
    setMoreOpen(false)
    if (next === 'vault' && isPhone) setMobileDetail(false)
  }

  function startNew() {
    const entry = blankEntry('login')
    setDraft(entry)
    setSelectedId(entry.id)
    setView('vault')
    setFilter('all')
    setMobileDetail(true)
    setMoreOpen(false)
  }

  function openEntry(id: string) {
    setDraft(null)
    setSelectedId(id)
    setView('vault')
    setFilter('all')
    setMobileDetail(true)
    setMoreOpen(false)
  }

  function backToList() {
    setMobileDetail(false)
    setDraft(null)
  }

  const shellClass = [
    'shell',
    view === 'vault' ? 'shell-vault' : '',
    isPhone && view === 'vault' && mobileDetail ? 'mobile-detail' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={shellClass}>
      <header className="mobile-top">
        <span className="brand-mark sm">
          <IconKey size={18} />
        </span>
        <div className="mobile-top-copy">
          <strong>Kunci</strong>
          <span className="muted">{NAV.find((item) => item.id === view)?.label}</span>
        </div>
        <button type="button" className="icon-btn" title="Kunci brankas" onClick={lock}>
          <IconLock size={18} />
        </button>
      </header>

      <aside className="sidebar">
        <div className="brand brand-side">
          <span className="brand-mark sm">
            <IconKey size={18} />
          </span>
          <div>
            <strong>Kunci</strong>
            <span className="muted">Satu brankas</span>
          </div>
        </div>
        <nav>
          {NAV.map((item) => {
            const Icon = item.icon
            const compactHidden = compactNav && MORE_NAV.has(item.id)
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${view === item.id ? 'active' : ''} ${compactHidden ? 'nav-secondary' : ''}`}
                onClick={() => goView(item.id)}
              >
                <Icon size={compactNav ? 22 : 18} />
                <span>{item.label}</span>
              </button>
            )
          })}
          {compactNav ? (
            <button
              type="button"
              className={`nav-item nav-more-btn ${MORE_NAV.has(view) || moreOpen ? 'active' : ''}`}
              onClick={() => setMoreOpen((open) => !open)}
            >
              <IconMore size={22} />
              <span>Lainnya</span>
            </button>
          ) : null}
        </nav>
        <div className="sidebar-foot">
          <span className={`dot ${helperOnline ? 'on' : ''}`} />
          {helperOnline ? 'Helper Mac' : 'Helper off'}
          <button type="button" className="icon-btn" title="Kunci (⌘L)" onClick={lock}>
            <IconLock size={16} />
          </button>
        </div>
        {compactNav && moreOpen ? (
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
                    {item.label}
                  </button>
                )
              })}
              <button type="button" className="nav-item" onClick={() => lock()}>
                <IconLock size={20} />
                Kunci brankas
              </button>
            </div>
          </div>
        ) : null}
      </aside>

      {view === 'vault' ? (
        <>
          <section className="list-col">
            <div className="list-toolbar">
              <div className="search">
                <IconSearch size={16} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari nama, situs, username…"
                  enterKeyHint="search"
                />
              </div>
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
                <button type="button" className="btn btn-primary" onClick={startNew}>
                  <IconPlus size={16} /> Baru
                </button>
              )}
            </div>
            <div className="filter-row">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`chip ${filter === f.id ? 'active' : ''}`}
                  onClick={() => {
                    setFilter(f.id)
                    setDraft(null)
                    if (isPhone) setMobileDetail(false)
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <ul className="entry-list">
              {filtered.length === 0 ? (
                <li className="empty">Tidak ada entri.</li>
              ) : (
                filtered.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      className={`entry-row ${selected?.id === e.id ? 'active' : ''}`}
                      onClick={() => {
                        setDraft(null)
                        setSelectedId(e.id)
                        setMobileDetail(true)
                      }}
                    >
                      <EntryGlyph entry={e} />
                      <span>
                        <strong>
                          {e.favorite ? <IconStar size={12} /> : null} {e.name}
                        </strong>
                        <em>{e.username || e.url || e.appName || e.type}</em>
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </section>
          <section className="detail-col">
            {selected ? (
              <EntryPane
                key={`${selected.id}-${selected.updatedAt}-${filter}`}
                entry={selected}
                isNew={Boolean(draft && draft.id === selected.id)}
                inTrash={filter === 'trash'}
                onCloseNew={startNew}
                onBack={isPhone ? backToList : undefined}
              />
            ) : (
              <div className="empty tall">Pilih entri atau buat yang baru.</div>
            )}
          </section>
        </>
      ) : (
        <section className="main-col">
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

function EntryGlyph({ entry }: { entry: Entry }) {
  const src = faviconUrl(entry.url)
  const { letter, hue } = letterAvatar(entry.name || entry.appName || '?')
  if (src) {
    return (
      <img
        className="glyph"
        src={src}
        alt=""
        onError={(e) => {
          e.currentTarget.style.display = 'none'
        }}
      />
    )
  }
  const Icon = entry.type === 'app' ? IconApp : entry.type === 'note' ? IconNote : entry.type === 'totp' ? IconOtp : IconGlobe
  return (
    <span className="glyph letter" style={{ background: `hsl(${hue} 40% 22%)`, color: `hsl(${hue} 70% 72%)` }}>
      {entry.type === 'login' ? letter : <Icon size={14} />}
    </span>
  )
}
