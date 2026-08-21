import { useEffect, useMemo, useState } from 'react'
import type { Entry } from '../types'
import { searchEntries } from '../lib/search'

export function QuickFind({
  entries,
  onClose,
  onSelect,
  onAction,
}: {
  entries: Entry[]
  onClose: () => void
  onSelect: (id: string) => void
  onAction: (action: 'new' | 'lock' | 'generator') => void
}) {
  const [q, setQ] = useState('')
  const found = useMemo(() => searchEntries(entries, q).slice(0, 8), [entries, q])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div className="quickfind" onMouseDown={(e) => e.stopPropagation()}>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari atau ketik perintah…" />
        <div className="quick-actions">
          <button type="button" onClick={() => onAction('new')}>
            Entri baru
          </button>
          <button type="button" onClick={() => onAction('generator')}>
            Generator
          </button>
          <button type="button" onClick={() => onAction('lock')}>
            Kunci brankas
          </button>
        </div>
        <ul>
          {found.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => onSelect(e.id)}>
                <strong>{e.name}</strong>
                <span>{e.username || e.url || e.appName}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
