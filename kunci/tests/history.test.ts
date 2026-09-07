import { describe, expect, it } from 'vitest'
import { flattenHistory, restoreHistoryRecord, withCredentialHistory } from '../src/lib/history'
import type { Entry } from '../src/types'

function entry(partial: Partial<Entry>): Entry {
  const now = 1_700_000_000_000
  return {
    id: 'e1',
    type: 'login',
    name: 'Mail',
    urls: [],
    tags: [],
    favorite: false,
    customFields: [],
    history: [],
    createdAt: now,
    updatedAt: now,
    username: 'lama@tif.dev',
    password: 'lama-pass',
    ...partial,
  }
}

describe('credential history', () => {
  it('records previous username and password when they change', () => {
    const prev = entry({})
    const next = withCredentialHistory(prev, { ...prev, password: 'baru-pass' })
    expect(next.history).toHaveLength(1)
    expect(next.history[0]?.password).toBe('lama-pass')
    expect(next.history[0]?.username).toBe('lama@tif.dev')
    expect(next.password).toBe('baru-pass')
  })

  it('does not add history when credentials stay the same', () => {
    const prev = entry({})
    const next = withCredentialHistory(prev, { ...prev, notes: 'halo' })
    expect(next.history).toHaveLength(0)
  })

  it('can restore an old record (and archives the current one)', () => {
    const prev = entry({})
    const changed = withCredentialHistory(prev, { ...prev, password: 'baru-pass' })
    const restored = restoreHistoryRecord(changed, changed.history[0]!)
    expect(restored.password).toBe('lama-pass')
    expect(restored.history[0]?.password).toBe('baru-pass')
  })

  it('flattens history newest first', () => {
    const a = withCredentialHistory(entry({ id: 'a', name: 'A' }), entry({ id: 'a', name: 'A', password: 'x' }))
    const rows = flattenHistory([a])
    expect(rows[0]?.entryName).toBe('A')
  })
})
