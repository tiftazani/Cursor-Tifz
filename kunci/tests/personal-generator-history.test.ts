import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const view = (name: string) => readFileSync(join(__dirname, '../src/views', name), 'utf8')

describe('personal vault secret presentation', () => {
  it('masks generated candidates by default and hides them again on regeneration', () => {
    const source = view('GeneratorView.tsx')
    expect(source).toContain('useState(false)')
    expect(source).toContain('setRevealed(false)')
    expect(source).toContain("type={revealed ? 'text' : 'password'}")
    expect(source).not.toContain('<code>{s}</code>')
    expect(source).not.toContain("{preview || '—'}")
  })

  it('explains clipboard clearing through the existing vault copy action', () => {
    const source = view('GeneratorView.tsx')
    expect(source).toContain('copySecret(')
    expect(source).toContain('papan klip')
    expect(source).not.toContain('navigator.clipboard.writeText')
  })

  it('never copies an absent historical password and keeps history masked', () => {
    const source = view('HistoryView.tsx')
    expect(source).toContain('row.record.password ?')
    expect(source).not.toContain("copySecret('Password lama', row.record.password ?? '')")
    expect(source).not.toContain('{row.record.password}')
  })
})
