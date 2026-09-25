/**
 * Selecting more than one entry in the list, and acting on the whole selection.
 *
 * Kept as pure functions because the rules are mostly about what must NOT happen:
 * a plain click has to stay a plain click, a shift-click across a search boundary
 * must not silently include the rows hidden between them, and a bulk delete has to
 * name how many permanent deletes it is about to do.
 */
export type ToggleMode = 'plain' | 'range' | 'add'

/**
 * What a click on a row means.
 *
 * - `plain` replaces the selection and opens the entry (the behaviour the list always had).
 * - `range` extends from the last clicked row to this one, like every file list.
 * - `add` toggles one row, so a mistake does not throw away the rest.
 */
export function clickMode(e: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }): ToggleMode {
  if (e.shiftKey) return 'range'
  // ⌘ on macOS, Ctrl on Windows and Linux. The app runs in both, so accept either.
  if (e.metaKey || e.ctrlKey) return 'add'
  return 'plain'
}

/**
 * The ids a range click should select.
 *
 * The range is taken **inside the visible order** the user is looking at, because
 * that is the only sequence they can point at. When a search is active the list is a
 * subset of the vault, so a range that walked the vault would quietly sweep in rows
 * the user cannot see.
 */
export function rangeSelection(visibleIds: string[], lastId: string | null, targetId: string): string[] {
  const target = visibleIds.indexOf(targetId)
  if (target < 0) return []
  const anchor = lastId ? visibleIds.indexOf(lastId) : -1
  // No usable anchor means there is nothing to extend from, so this click becomes the
  // anchor itself rather than selecting some arbitrary block.
  if (anchor < 0) return [targetId]
  const [from, to] = anchor <= target ? [anchor, target] : [target, anchor]
  return visibleIds.slice(from, to + 1)
}

/** Add or remove one row, leaving the rest of the selection alone. */
export function toggleSelection(selected: string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]
}

/** The selected ids that still exist in the list on screen. */
export function keptSelection(selected: string[], visibleIds: string[]): string[] {
  const visible = new Set(visibleIds)
  return selected.filter((id) => visible.has(id))
}

export type BulkDeleteIntent =
  | { action: 'trash'; ids: string[] }
  | { action: 'purge'; ids: string[] }
  | { action: 'none'; reason: 'empty' | 'overlay' }

/**
 * What Delete should do to a whole selection.
 *
 * Trashing a group needs no dialog: it is recoverable, and asking once per entry would
 * make clearing twenty rows unusable. Purging always asks, and the wording comes from
 * `purgeQuestion` so the count is never left to the caller to remember.
 */
export function bulkDeleteIntent(opts: {
  ids: string[]
  inTrash: boolean
  overlayOpen: boolean
}): BulkDeleteIntent {
  if (opts.overlayOpen) return { action: 'none', reason: 'overlay' }
  // An empty list must not fall through as "purge everything", which is what an
  // accidental click on a bulk button with nothing selected would mean.
  if (!opts.ids.length) return { action: 'none', reason: 'empty' }
  return opts.inTrash ? { action: 'purge', ids: opts.ids } : { action: 'trash', ids: opts.ids }
}

/** The confirmation for a permanent bulk delete, with the count always spelled out. */
export function purgeQuestion(count: number): string {
  return `Hapus permanen ${count} entri? Ini tidak bisa dibatalkan.`
}

/** The line above the list while a selection is active. */
export function selectionLabel(count: number): string {
  return `${count} entri dipilih`
}

/** What the app says after trashing a group. */
export function trashSummary(count: number, firstName: string): string {
  return count === 1 ? `"${firstName}" masuk sampah.` : `${count} entri masuk sampah.`
}
