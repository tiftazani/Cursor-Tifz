import { useState } from 'react'
import { copyText } from '../lib/clipboard'

export function RecoveryKeyModal({
  recoveryKey,
  onDone,
  onEmail,
}: {
  recoveryKey: string
  onDone: () => void
  onEmail?: () => Promise<boolean>
}) {
  const [copied, setCopied] = useState(false)
  const [emailed, setEmailed] = useState<'idle' | 'ok' | 'fail'>('idle')
  const [busy, setBusy] = useState(false)

  return (
    <div className="modal-back">
      <div className="quickfind" style={{ padding: 20 }}>
        <h2>Simpan recovery key</h2>
        <p className="muted">
          Ini satu-satunya cara mereset kata sandi induk tanpa kehilangan data. Server tidak menyimpan kunci ini. Simpan di
          tempat yang bukan brankas Kunci (pengelola password lain, kertas, atau disk terenkripsi).
        </p>
        <p className="totp-code" style={{ fontSize: '1.1rem', letterSpacing: '0.08em', margin: '16px 0' }}>
          {recoveryKey}
        </p>
        <div className="row-actions">
          <button
            type="button"
            className="btn"
            onClick={() => {
              void copyText(recoveryKey).then(() => setCopied(true))
            }}
          >
            {copied ? 'Tersalin' : 'Salin'}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              const blob = new Blob([`Kunci recovery key\n${recoveryKey}\n`], { type: 'text/plain' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'kunci-recovery-key.txt'
              a.click()
              URL.revokeObjectURL(url)
            }}
          >
            Unduh .txt
          </button>
          {onEmail ? (
            <button
              type="button"
              className="btn"
              disabled={busy || emailed === 'ok'}
              onClick={() => {
                setBusy(true)
                void onEmail()
                  .then((ok) => setEmailed(ok ? 'ok' : 'fail'))
                  .finally(() => setBusy(false))
              }}
            >
              {emailed === 'ok' ? 'Terkirim ke Gmail' : 'Kirim ke Gmail (kurang aman)'}
            </button>
          ) : null}
          <button type="button" className="btn btn-primary" onClick={onDone}>
            Sudah saya simpan
          </button>
        </div>
        {emailed === 'fail' ? <p className="error">Gagal mengirim email. Simpan kunci secara offline.</p> : null}
        {onEmail ? (
          <p className="muted" style={{ marginTop: 12 }}>
            Mengirim recovery key ke Gmail berarti orang yang menguasai kotak masuk itu bisa mereset brankas jika mereka
            juga masuk ke situs ini. Lebih aman tidak mengirim.
          </p>
        ) : null}
      </div>
    </div>
  )
}
