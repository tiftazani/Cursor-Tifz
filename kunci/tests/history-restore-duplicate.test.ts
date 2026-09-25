import { describe, expect, it } from 'vitest'
import { withCredentialHistory, restoreHistoryRecord } from '../src/lib/history'
import type { Entry } from '../src/types'

function entry(password: string, history: Entry['history'] = []): Entry {
  return {
    id: 'e1',
    type: 'login',
    name: 'Situs',
    username: 'tif',
    password,
    urls: [],
    tags: [],
    favorite: false,
    customFields: [],
    history,
    createdAt: 0,
    updatedAt: 0,
  }
}

/**
 * The second audit (`deleg_7516cfee`) reported that clicking "Pakai lagi" and then
 * saving stored the same password twice. Walking the exact sequence it described
 * shows one record per distinct value, with and without any guard:
 * `withCredentialHistory` archives `previous.password` into `previous.history`, so
 * the record the restore step added is replaced rather than appended. These tests
 * pin the real behavior down, so a future change cannot quietly create the
 * duplicate the report expected to find.
 */
describe('history after "Pakai lagi" and save', () => {
  it('keeps one record per distinct password', () => {
    // 1. password `lama` → user sets `baru` and saves
    const afterChange = withCredentialHistory(entry('lama'), entry('baru'))
    expect(afterChange.password).toBe('baru')
    expect(afterChange.history.map((h) => h.password)).toEqual(['lama'])

    // 2. open history, click "Pakai lagi" on `lama`
    const restored = restoreHistoryRecord(afterChange, afterChange.history[0]!)

    // 3. save the restored draft
    const saved = withCredentialHistory(afterChange, restored)

    expect(saved.password).toBe('lama')
    const values = saved.history.map((h) => h.password)
    expect(values).toEqual(['baru', 'lama'])
    expect(values.filter((v) => v === 'baru')).toHaveLength(1)
    expect(values.filter((v) => v === 'lama')).toHaveLength(1)
  })

  it('archives the value it replaced, not the one it kept', () => {
    const afterChange = withCredentialHistory(entry('lama'), entry('baru'))
    const restored = restoreHistoryRecord(afterChange, afterChange.history[0]!)
    const saved = withCredentialHistory(afterChange, restored)
    // The newest record must hold the password the entry had before this save.
    expect(saved.history[0]!.password).toBe('baru')
  })

  it('still records a genuine second change', () => {
    const first = withCredentialHistory(entry('lama'), entry('baru'))
    const second = withCredentialHistory(first, entry('baru2'))
    expect(second.history.map((h) => h.password)).toEqual(['baru', 'lama'])
  })

  it('drops the oldest records past the cap instead of growing forever', () => {
    let e = entry('p0')
    for (let i = 1; i <= 60; i++) e = withCredentialHistory(e, entry(`p${i}`))
    expect(e.history).toHaveLength(50)
    expect(e.history[0]!.password).toBe('p59')
  })
})
