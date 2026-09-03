import { useEffect, useMemo, useState } from 'react'
import type { Entry } from '../types'
import { listHelperApps, promptHelperAccess } from '../lib/helper'
import { useVault } from '../state/VaultContext'
import { Field } from './Field'

export function FillMacDialog({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const { vault, helperOnline, helperAccessibility, fillMac, fillFrontmostApp } = useVault()
  const [apps, setApps] = useState<string[]>([])
  const [appName, setAppName] = useState(entry.appName || '')
  const [busy, setBusy] = useState(false)
  const helperUrl = vault?.settings.helperUrl || ''

  useEffect(() => {
    if (!helperOnline) return
    void listHelperApps(helperUrl).then((res) => {
      setApps(res.apps)
      const saved = (entry.appName || entry.name || '').toLowerCase()
      const match = res.apps.find((name) => {
        const n = name.toLowerCase()
        return saved && (n === saved || n.includes(saved) || saved.includes(n))
      })
      if (match) setAppName(match)
    })
  }, [helperOnline, helperUrl, entry.appName, entry.name])

  const options = useMemo(() => {
    if (appName && !apps.includes(appName)) return [appName, ...apps]
    return apps
  }, [apps, appName])

  async function fillNow() {
    setBusy(true)
    try {
      await fillMac(entry, { appName: appName || entry.appName })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  async function fillAfterClick() {
    setBusy(true)
    try {
      await fillFrontmostApp(entry)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-back" role="dialog" aria-labelledby="fill-mac-title" onClick={onClose}>
      <div className="modal-card fill-mac-card" onClick={(e) => e.stopPropagation()}>
        <h3 id="fill-mac-title">Isi username & password ke app Mac</h3>
        {helperOnline ? (
          <>
            <p className="muted">
              Kunci tidak mengetik ke jendela ini. Helper mengaktifkan app yang kamu pilih, lalu mengisi field login di
              sana — website dan aplikasi desktop.
            </p>
            <p className={`status-line ${helperAccessibility ? 'ok' : 'warn-text'}`}>
              Accessibility:{' '}
              {helperAccessibility
                ? 'Kunci Helper diizinkan'
                : 'belum — osascript tidak muncul di daftar itu. Centang Kunci Helper, atau klik tombol di bawah.'}
            </p>
            {!helperAccessibility ? (
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() => {
                  void promptHelperAccess(helperUrl, vault?.settings.helperToken || '')
                }}
              >
                Minta izin Kunci Helper
              </button>
            ) : null}
            <Field label="Aplikasi yang sedang terbuka">
              <select className="input" value={appName} onChange={(e) => setAppName(e.target.value)}>
                <option value="">Pilih aplikasi…</option>
                {options.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="row-actions">
              <button type="button" className="btn btn-primary" disabled={busy || !appName} onClick={() => void fillNow()}>
                {busy ? 'Mengisi…' : 'Isi sekarang'}
              </button>
              <button type="button" className="btn" disabled={busy} onClick={() => void fillAfterClick()}>
                Isi ke jendela yang saya klik (4 dtk)
              </button>
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Batal
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted">
              Helper Mac tidak terhubung. Situs cloud dan localhost memakai helper yang sama di{' '}
              <code>127.0.0.1:8780</code>.
            </p>
            <ol className="steps">
              <li>
                Di folder <code>kunci</code>: <code>npm run install-service</code>
              </li>
              <li>Izinkan <strong>Kunci Helper</strong> di Accessibility (bukan osascript)</li>
              <li>Biarkan helper menyala, lalu buka lagi cloud atau http://127.0.0.1:8780</li>
            </ol>
            <button type="button" className="btn" onClick={onClose}>
              Tutup
            </button>
          </>
        )}
      </div>
    </div>
  )
}
