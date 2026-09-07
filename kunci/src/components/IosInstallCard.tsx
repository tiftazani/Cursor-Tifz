import { useState } from 'react'
import { IconShare } from './Icons'
import { dismissIosInstall, isStandaloneDisplay, readInstallDismissed, shouldOfferIosInstall } from '../lib/pwa'

function Steps() {
  return (
    <ol className="install-steps">
      <li>
        Buka Safari, lalu ketuk <strong>Bagikan</strong>
        <span className="install-share" aria-hidden="true">
          <IconShare size={16} />
        </span>
        di bawah layar
      </li>
      <li>
        Gulir, pilih <strong>Tambah ke Layar Utama</strong>
      </li>
      <li>
        Ketuk <strong>Tambah</strong> — ikon Kunci muncul di layar Utama
      </li>
    </ol>
  )
}

export function IosInstallCard() {
  const [open, setOpen] = useState(() =>
    shouldOfferIosInstall({
      standalone: isStandaloneDisplay(),
      dismissed: readInstallDismissed(),
    }),
  )
  if (!open) return null
  return (
    <div className="install-card card stack">
      <h3>Pasang di iPhone</h3>
      <p className="muted">Tidak lewat App Store. Sekali pasang, buka dari ikon di layar Utama seperti aplikasi biasa.</p>
      <Steps />
      <button
        type="button"
        className="btn"
        onClick={() => {
          dismissIosInstall()
          setOpen(false)
        }}
      >
        Nanti saja
      </button>
    </div>
  )
}

export function IosInstallGuide() {
  if (isStandaloneDisplay()) {
    return (
      <div className="card stack install-card">
        <h3>Aplikasi iPhone</h3>
        <p className="muted">Kunci sudah terpasang di layar Utama. Buka dari ikon Kunci supaya tidak ada bilah Safari.</p>
      </div>
    )
  }
  return (
    <div className="card stack install-card">
      <h3>Pasang di iPhone</h3>
      <p className="muted">
        Di iPhone 15 Pro Max: Safari → situs ini → Bagikan → Tambah ke Layar Utama. Tidak perlu App Store atau TestFlight.
      </p>
      <Steps />
    </div>
  )
}
