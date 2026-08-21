import { useState } from 'react'
import { Field } from '../components/Field'
import { DEFAULT_GENERATOR, generateMany, type GeneratorOptions } from '../lib/generator'
import { passwordStrength } from '../lib/strength'
import { useVault } from '../state/VaultContext'

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
        <p className="muted">Buat password acak atau passphrase yang mudah diketik.</p>
      </header>
      <div className="gen-layout">
        <div className="card">
          <div className="type-row">
            <button type="button" className={`chip ${opts.mode === 'random' ? 'active' : ''}`} onClick={() => patch({ mode: 'random' })}>
              Acak
            </button>
            <button
              type="button"
              className={`chip ${opts.mode === 'passphrase' ? 'active' : ''}`}
              onClick={() => patch({ mode: 'passphrase' })}
            >
              Passphrase
            </button>
          </div>
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
              <label className="check">
                <input type="checkbox" checked={opts.upper} onChange={(e) => patch({ upper: e.target.checked })} /> Huruf besar
              </label>
              <label className="check">
                <input type="checkbox" checked={opts.lower} onChange={(e) => patch({ lower: e.target.checked })} /> Huruf kecil
              </label>
              <label className="check">
                <input type="checkbox" checked={opts.digits} onChange={(e) => patch({ digits: e.target.checked })} /> Angka
              </label>
              <label className="check">
                <input type="checkbox" checked={opts.symbols} onChange={(e) => patch({ symbols: e.target.checked })} /> Simbol
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={opts.excludeAmbiguous}
                  onChange={(e) => patch({ excludeAmbiguous: e.target.checked })}
                />{' '}
                Hindari 0/O/l/1
              </label>
            </>
          ) : (
            <>
              <Field label={`Jumlah kata · ${opts.words}`}>
                <input type="range" min={3} max={10} value={opts.words} onChange={(e) => patch({ words: Number(e.target.value) })} />
              </Field>
              <label className="check">
                <input type="checkbox" checked={opts.capitalize} onChange={(e) => patch({ capitalize: e.target.checked })} /> Kapital tiap kata
              </label>
              <label className="check">
                <input type="checkbox" checked={opts.numberSuffix} onChange={(e) => patch({ numberSuffix: e.target.checked })} /> Tambah angka
              </label>
            </>
          )}
        </div>
        <div className="card">
          <p className="muted">Kekuatan: {strength.label}</p>
          <ul className="sample-list">
            {samples.map((s) => (
              <li key={s}>
                <code>{s}</code>
                <button type="button" className="btn btn-ghost" onClick={() => void copySecret('Password', s)}>
                  Salin
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-primary" onClick={() => apply({ ...opts })}>
            Acak lagi
          </button>
        </div>
      </div>
    </div>
  )
}
