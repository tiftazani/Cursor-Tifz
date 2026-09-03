import { useState } from 'react'
import { Field, Segmented, StrengthBar } from '../components/Field'
import { DEFAULT_GENERATOR, generateMany, type GeneratorOptions } from '../lib/generator'
import { passwordStrength } from '../lib/strength'
import { useVault } from '../state/VaultContext'

const MODES = [
  { id: 'random', label: 'Acak' },
  { id: 'passphrase', label: 'Passphrase' },
] as const

export function GeneratorView() {
  const { copySecret } = useVault()
  const [opts, setOpts] = useState<GeneratorOptions>(DEFAULT_GENERATOR)
  const [samples, setSamples] = useState(() => generateMany(5, DEFAULT_GENERATOR))
  const preview = samples[0] ?? ''
  const strength = passwordStrength(preview)

  function apply(next: GeneratorOptions) {
    setOpts(next)
    try {
      setSamples(generateMany(5, next))
    } catch {
      setSamples([])
    }
  }

  function patch(p: Partial<GeneratorOptions>) {
    apply({ ...opts, ...p })
  }

  return (
    <div className="page">
      <header className="page-head">
        <h2>Generator</h2>
        <p className="muted">Password acak atau passphrase. Salin, atau tempel ke entri dari layar Brankas.</p>
      </header>
      <div className="gen-layout">
        <div className="card">
          <Segmented
            value={opts.mode}
            options={MODES}
            onChange={(mode) => patch({ mode })}
          />
          {opts.mode === 'random' ? (
            <>
              <Field label={`Panjang · ${opts.length}`}>
                <input
                  type="range"
                  min={8}
                  max={64}
                  value={opts.length}
                  onChange={(e) => patch({ length: Number(e.target.value) })}
                />
              </Field>
              <div className="check-list">
                <label className="check">
                  <input type="checkbox" checked={opts.upper} onChange={(e) => patch({ upper: e.target.checked })} />
                  Huruf besar
                </label>
                <label className="check">
                  <input type="checkbox" checked={opts.lower} onChange={(e) => patch({ lower: e.target.checked })} />
                  Huruf kecil
                </label>
                <label className="check">
                  <input type="checkbox" checked={opts.digits} onChange={(e) => patch({ digits: e.target.checked })} />
                  Angka
                </label>
                <label className="check">
                  <input type="checkbox" checked={opts.symbols} onChange={(e) => patch({ symbols: e.target.checked })} />
                  Simbol
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={opts.excludeAmbiguous}
                    onChange={(e) => patch({ excludeAmbiguous: e.target.checked })}
                  />
                  Hindari 0/O/l/1
                </label>
              </div>
            </>
          ) : (
            <>
              <Field label={`Jumlah kata · ${opts.words}`}>
                <input type="range" min={3} max={10} value={opts.words} onChange={(e) => patch({ words: Number(e.target.value) })} />
              </Field>
              <div className="check-list">
                <label className="check">
                  <input type="checkbox" checked={opts.capitalize} onChange={(e) => patch({ capitalize: e.target.checked })} />
                  Kapital tiap kata
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={opts.numberSuffix}
                    onChange={(e) => patch({ numberSuffix: e.target.checked })}
                  />
                  Tambah angka
                </label>
              </div>
            </>
          )}
        </div>
        <div className="card">
          <code className="gen-password">{preview || '—'}</code>
          <StrengthBar score={strength.score} label={strength.label} />
          <div className="row-actions">
            <button type="button" className="btn btn-primary" onClick={() => void copySecret('Password', preview)} disabled={!preview}>
              Salin
            </button>
            <button type="button" className="btn" onClick={() => apply({ ...opts })}>
              Acak lagi
            </button>
          </div>
          {samples.length > 1 ? (
            <>
              <span className="field-label">Pilihan lain</span>
              <ul className="sample-list">
                {samples.slice(1).map((s) => (
                  <li key={s}>
                    <code>{s}</code>
                    <button type="button" className="btn btn-ghost" onClick={() => void copySecret('Password', s)}>
                      Salin
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
