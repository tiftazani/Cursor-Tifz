import { useEffect, useState } from 'react'
import type { CustomField, Entry, EntryType } from '../types'
import { Field, SecretInput, StrengthBar, TextArea, TextInput } from '../components/Field'
import { IconCopy, IconFill, IconStar, IconTrash } from '../components/Icons'
import { generatePassword, DEFAULT_GENERATOR } from '../lib/generator'
import { passwordStrength } from '../lib/strength'
import { totpCode } from '../lib/totp'
import { formatDateTime, relativeTime } from '../lib/time'
import { restoreHistoryRecord } from '../lib/history'
import { newId } from '../lib/id'
import { useVault } from '../state/VaultContext'

const TYPES: { id: EntryType; label: string }[] = [
  { id: 'login', label: 'Website' },
  { id: 'app', label: 'Aplikasi Mac' },
  { id: 'password', label: 'Password saja' },
  { id: 'note', label: 'Catatan' },
  { id: 'totp', label: 'Authenticator' },
]

export function EntryPane({
  entry,
  isNew,
  inTrash = false,
  onCloseNew,
}: {
  entry: Entry
  isNew: boolean
  inTrash?: boolean
  onCloseNew?: () => void
}) {
  const { saveEntry, deleteEntry, restoreEntry, purgeEntry, copySecret, sequentialCopy, fillMac, helperOnline } = useVault()
  const [draft, setDraft] = useState(entry)
  const [totp, setTotp] = useState<{ code: string; remaining: number } | null>(null)

  useEffect(() => {
    const secret = draft.totpSecret
    if (!secret) return
    let alive = true
    const tick = async () => {
      try {
        const t = await totpCode(secret)
        if (alive) setTotp({ code: t.code, remaining: t.remaining })
      } catch {
        if (alive) setTotp(null)
      }
    }
    void tick()
    const id = window.setInterval(() => void tick(), 1000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [draft.totpSecret])

  if (inTrash) {
    return (
      <article className="pane">
        <header className="pane-head">
          <div>
            <h2>{entry.name}</h2>
            <p className="muted">Di sampah</p>
          </div>
        </header>
        <p className="muted">{entry.username || entry.url || entry.appName}</p>
        <div className="row-actions">
          <button type="button" className="btn" onClick={() => void restoreEntry(entry.id)}>
            Pulihkan
          </button>
          <button type="button" className="btn btn-danger" onClick={() => void purgeEntry(entry.id)}>
            Hapus permanen
          </button>
        </div>
      </article>
    )
  }

  const strength = draft.password ? passwordStrength(draft.password) : null

  function patch(p: Partial<Entry>) {
    setDraft((d) => ({ ...d, ...p }))
  }

  async function save() {
    if (!draft.name.trim()) return
    await saveEntry(
      {
        ...draft,
        name: draft.name.trim(),
        updatedAt: Date.now(),
        passwordChangedAt: draft.password ? (draft.passwordChangedAt ?? Date.now()) : draft.passwordChangedAt,
      },
      isNew,
    )
    onCloseNew?.()
  }

  function addField() {
    const field: CustomField = { id: newId(), label: 'Field', value: '', hidden: false }
    patch({ customFields: [...draft.customFields, field] })
  }

  return (
    <article className="pane">
      <header className="pane-head">
        <div>
          <h2>{isNew ? 'Entri baru' : draft.name || 'Tanpa nama'}</h2>
          <p className="muted">{TYPES.find((t) => t.id === draft.type)?.label}</p>
        </div>
        <div className="row-actions">
          <button
            type="button"
            className={`icon-btn ${draft.favorite ? 'on' : ''}`}
            title="Favorit"
            onClick={() => patch({ favorite: !draft.favorite })}
          >
            <IconStar />
          </button>
          {!isNew ? (
            <button type="button" className="icon-btn danger" title="Buang" onClick={() => void deleteEntry(draft.id)}>
              <IconTrash />
            </button>
          ) : null}
        </div>
      </header>

      <div className="type-row">
        {TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`chip ${draft.type === t.id ? 'active' : ''}`}
            onClick={() => patch({ type: t.id })}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="stack">
        <Field label="Nama">
          <TextInput value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Netflix, Slack, Wi-Fi rumah…" />
        </Field>

        {draft.type === 'login' || draft.type === 'app' ? (
          <Field label="Username / email">
            <div className="with-copy">
              <TextInput
                value={draft.username ?? ''}
                onChange={(e) => patch({ username: e.target.value })}
                placeholder="opsional"
                autoComplete="off"
              />
              <button type="button" className="icon-btn" onClick={() => void copySecret('Username', draft.username ?? '')}>
                <IconCopy size={16} />
              </button>
            </div>
          </Field>
        ) : null}

        {draft.type !== 'note' ? (
          <Field label={draft.type === 'totp' ? 'Password cadangan (opsional)' : 'Password'}>
            <SecretInput
              value={draft.password ?? ''}
              onChange={(v) => patch({ password: v })}
              onGenerate={() => patch({ password: generatePassword(DEFAULT_GENERATOR), passwordChangedAt: Date.now() })}
              onCopy={() => void copySecret('Password', draft.password ?? '')}
            />
          </Field>
        ) : null}
        {strength && draft.type !== 'note' ? <StrengthBar score={strength.score} label={strength.label} /> : null}

        {draft.type === 'login' ? (
          <Field label="URL website">
            <TextInput
              value={draft.url ?? ''}
              onChange={(e) => patch({ url: e.target.value })}
              placeholder="https://accounts.google.com"
            />
          </Field>
        ) : null}

        {draft.type === 'app' ? (
          <Field label="Nama aplikasi Mac">
            <TextInput
              value={draft.appName ?? ''}
              onChange={(e) => patch({ appName: e.target.value })}
              placeholder="Slack, Mail, Notes…"
            />
          </Field>
        ) : null}

        {draft.type === 'login' || draft.type === 'totp' || draft.type === 'app' ? (
          <Field label="Rahasia TOTP / otpauth" hint="Tempel secret Base32 atau URI otpauth://">
            <TextInput value={draft.totpSecret ?? ''} onChange={(e) => patch({ totpSecret: e.target.value })} />
          </Field>
        ) : null}

        {draft.totpSecret && totp ? (
          <div className="totp-card">
            <div>
              <span className="muted">Kode autentikator</span>
              <strong className="totp-code">{totp.code}</strong>
            </div>
            <div className="totp-right">
              <span>{totp.remaining}s</span>
              <button type="button" className="btn btn-ghost" onClick={() => void copySecret('Kode OTP', totp.code)}>
                Salin
              </button>
            </div>
          </div>
        ) : null}

        <Field label="Tag" hint="Pisahkan dengan koma">
          <TextInput
            value={draft.tags.join(', ')}
            onChange={(e) =>
              patch({
                tags: e.target.value
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean),
              })
            }
            placeholder="kerja, pribadi"
          />
        </Field>

        <Field label="Catatan">
          <TextArea rows={4} value={draft.notes ?? ''} onChange={(e) => patch({ notes: e.target.value })} />
        </Field>

        {draft.customFields.map((f, i) => (
          <div key={f.id} className="custom-field">
            <TextInput
              value={f.label}
              onChange={(e) => {
                const next = [...draft.customFields]
                next[i] = { ...f, label: e.target.value }
                patch({ customFields: next })
              }}
            />
            {f.hidden ? (
              <SecretInput
                value={f.value}
                onChange={(v) => {
                  const next = [...draft.customFields]
                  next[i] = { ...f, value: v }
                  patch({ customFields: next })
                }}
              />
            ) : (
              <TextInput
                value={f.value}
                onChange={(e) => {
                  const next = [...draft.customFields]
                  next[i] = { ...f, value: e.target.value }
                  patch({ customFields: next })
                }}
              />
            )}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => patch({ customFields: draft.customFields.filter((x) => x.id !== f.id) })}
            >
              Hapus
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-ghost" onClick={addField}>
          + Field kustom
        </button>
      </div>

      <div className="pane-actions">
        <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={!draft.name.trim()}>
          Simpan
        </button>
        {(draft.username || draft.password) && (
          <button type="button" className="btn" onClick={() => void sequentialCopy(draft)}>
            Salin berurutan
          </button>
        )}
        <button type="button" className="btn" onClick={() => void fillMac(draft)} disabled={!helperOnline}>
          <IconFill size={16} /> Isi ke app Mac
        </button>
      </div>

      {!isNew && draft.history.length > 0 ? (
        <section className="history-block">
          <h3>Riwayat username & password</h3>
          <ul>
            {draft.history.map((h) => (
              <li key={h.id}>
                <div>
                  <strong>{h.username || '—'}</strong>
                  <span className="muted">{formatDateTime(h.changedAt)}</span>
                </div>
                <div className="row-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => void copySecret('Password lama', h.password ?? '')}>
                    Salin lama
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setDraft(restoreHistoryRecord(draft, h))}
                  >
                    Pakai lagi
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="meta-line">
        {isNew ? 'Belum disimpan' : `Diperbarui ${relativeTime(entry.updatedAt)}`}
        {entry.lastUsedAt ? ` · dipakai ${relativeTime(entry.lastUsedAt)}` : ''}
      </p>
    </article>
  )
}
