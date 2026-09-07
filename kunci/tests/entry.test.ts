import { describe, expect, it } from 'vitest'
import { blankEntry } from '../src/state/VaultContext'

describe('blank entry form', () => {
  it('starts with empty secrets so the browser cannot pre-fill the master password', () => {
    const entry = blankEntry('login')
    expect(entry.name).toBe('')
    expect(entry.username).toBeUndefined()
    expect(entry.password).toBeUndefined()
    expect(entry.url).toBeUndefined()
    expect(entry.notes).toBeUndefined()
  })
})
