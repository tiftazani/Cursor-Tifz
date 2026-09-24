import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const gate = readFileSync(join(__dirname, '..', 'src', 'views', 'Gate.tsx'), 'utf8')
const field = readFileSync(join(__dirname, '..', 'src', 'components', 'Field.tsx'), 'utf8')

// The master password must never be handed to the browser's own password manager:
// once saved there, Chrome/Brave offers it on unrelated sites.
describe('master password is shielded from browser autofill', () => {
  it('does not opt the unlock field out of the shield', () => {
    expect(gate).not.toMatch(/protectFromAutofill=\{false\}/)
  })

  it('keeps the shield on by default', () => {
    expect(field).toMatch(/protectFromAutofill = true/)
  })

  it('marks the master field as new-password so the browser cannot offer an old one', () => {
    const unlock = gate.slice(gate.indexOf('export function LockScreen'))
    expect(unlock).toMatch(/autoComplete="new-password"/)
  })
})
