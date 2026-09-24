import { describe, expect, it } from 'vitest'
import { isAndroidEntry, moveAndroidToTrash, splitAndroidEntries } from '../src/lib/cleanup'
import { EMPTY_VAULT, type Entry } from '../src/types'

function entry(id: string, url: string, extra: Partial<Entry> = {}): Entry {
  return {
    id,
    type: 'login',
    name: id,
    url,
    urls: extra.urls ?? [],
    tags: [],
    favorite: false,
    customFields: [],
    history: [],
    createdAt: 1,
    updatedAt: 1,
    ...extra,
  }
}

describe('android cleanup', () => {
  it('spots an entry saved from an Android app', () => {
    expect(isAndroidEntry(entry('a', 'android://abc==@com.quora.android/'))).toBe(true)
    expect(isAndroidEntry(entry('b', 'https://www.amazon.com'))).toBe(false)
  })

  it('judges by the entry own url, never by its url history', () => {
    // urls is merge history. An entry that once picked up an android url while
    // merging must NOT be deleted: it is still a real website login.
    const merged = entry('c', 'https://www.amazon.com', { urls: ['android://abc==@com.quora.android/'] })
    expect(isAndroidEntry(merged)).toBe(false)
  })

  it('handles a missing url', () => {
    expect(isAndroidEntry(entry('d', '', { url: undefined }))).toBe(false)
  })

  it('splits a list without touching the rest', () => {
    const rows = [
      entry('keep1', 'https://www.amazon.com'),
      entry('drop1', 'android://a==@com.quora.android/'),
      entry('keep2', 'https://accounts.google.com'),
      entry('drop2', 'android://b==@com.traveloka.android/'),
    ]
    const { android, rest } = splitAndroidEntries(rows)
    expect(android.map((e) => e.id)).toEqual(['drop1', 'drop2'])
    expect(rest.map((e) => e.id)).toEqual(['keep1', 'keep2'])
  })

  it('splits an empty list', () => {
    expect(splitAndroidEntries([])).toEqual({ android: [], rest: [] })
  })

  it('keeps the original array untouched', () => {
    const rows = [entry('keep', 'https://www.amazon.com'), entry('drop', 'android://a==@com.x/')]
    const before = rows.length
    splitAndroidEntries(rows)
    expect(rows.length).toBe(before)
  })
})

describe('moveAndroidToTrash', () => {
  function vaultWith(entries: Entry[], trash: Entry[] = []) {
    return { ...EMPTY_VAULT, entries, trash }
  }

  it('moves android entries to the trash and leaves the rest', () => {
    const vault = vaultWith([
      entry('keep', 'https://www.amazon.com'),
      entry('drop', 'android://a==@com.quora.android/'),
      entry('drop2', 'android://b==@com.traveloka.android/'),
    ])
    const { vault: next, moved } = moveAndroidToTrash(vault, 5)
    expect(moved).toBe(2)
    expect(next.entries.map((e) => e.id)).toEqual(['keep'])
    expect(next.trash.map((e) => e.id)).toEqual(['drop', 'drop2'])
  })

  it('keeps entries already in the trash', () => {
    // An earlier delete must not be silently dropped by the cleanup.
    const vault = vaultWith([entry('drop', 'android://a==@com.x/')], [entry('old', 'https://old.test')])
    const { vault: next } = moveAndroidToTrash(vault, 5)
    expect(next.trash.map((e) => e.id)).toEqual(['drop', 'old'])
  })

  it('stamps the move time so the trash can sort it', () => {
    const vault = vaultWith([entry('drop', 'android://a==@com.x/', { updatedAt: 1 })])
    const { vault: next } = moveAndroidToTrash(vault, 99)
    expect(next.trash[0]?.updatedAt).toBe(99)
  })

  it('returns the same vault and moves nothing when there is no android entry', () => {
    const vault = vaultWith([entry('keep', 'https://www.amazon.com')])
    const { vault: next, moved } = moveAndroidToTrash(vault, 5)
    expect(moved).toBe(0)
    expect(next).toBe(vault)
  })

  it('is not fooled by an android url in merge history', () => {
    const merged = entry('keep', 'https://www.amazon.com', { urls: ['android://a==@com.x/'] })
    const { moved } = moveAndroidToTrash(vaultWith([merged]), 5)
    expect(moved).toBe(0)
  })

  it('handles an empty vault', () => {
    const { moved } = moveAndroidToTrash(vaultWith([]), 5)
    expect(moved).toBe(0)
  })
})
