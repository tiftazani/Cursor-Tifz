import type { Entry, Vault } from '../types'
import { isAndroidAppUrl } from './match'

/**
 * Whether an entry was saved from an Android app rather than a website.
 *
 * Judged by the entry's own url only. `urls` is merge history, so an entry that
 * once picked up an android url while merging would be wrongly deleted.
 */
export function isAndroidEntry(entry: Entry): boolean {
  return isAndroidAppUrl(entry.url || '')
}

/**
 * Splits entries into the Android app logins and everything else.
 * Returns new arrays; the input is not modified.
 */
export function splitAndroidEntries(entries: Entry[]): { android: Entry[]; rest: Entry[] } {
  const android: Entry[] = []
  const rest: Entry[] = []
  for (const entry of entries) {
    if (isAndroidEntry(entry)) android.push(entry)
    else rest.push(entry)
  }
  return { android, rest }
}

/**
 * Moves every Android app login in a vault to its trash.
 *
 * Trash, not deletion: the caller can still undo it. Existing trash is kept, so
 * an earlier delete is not silently lost. Returns the same vault untouched when
 * there is nothing to move.
 */
export function moveAndroidToTrash(vault: Vault, now = Date.now()): { vault: Vault; moved: number } {
  const { android, rest } = splitAndroidEntries(vault.entries)
  if (!android.length) return { vault, moved: 0 }
  return {
    vault: {
      ...vault,
      entries: rest,
      trash: [...android.map((e) => ({ ...e, updatedAt: now })), ...vault.trash],
    },
    moved: android.length,
  }
}
