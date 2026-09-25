/**
 * What the Delete key is allowed to do to the entry list.
 *
 * The rule is small on purpose, and each half protects something a person would be
 * upset to lose: an entry they were typing into, or an entry they cannot get back.
 * Keeping it as a pure function means the guards are testable without a DOM, and the
 * call site cannot quietly drop one.
 */
export type DeleteIntent =
  | { action: 'trash'; id: string }
  | { action: 'purge'; id: string }
  | { action: 'none'; reason: 'no-selection' | 'editing' | 'overlay' | 'confirm-pending' }

export function deleteIntent(opts: {
  /** The entry the list has selected, or null. */
  selectedId: string | null
  /** True while the trash filter is showing, where delete means permanent. */
  inTrash: boolean
  /** True when focus is inside a text field, so Delete must stay an editing key. */
  typing: boolean
  /** True when a dialog or the quick-find panel owns the keyboard. */
  overlayOpen: boolean
  /** True when the user already has a confirmation on screen. */
  confirmPending: boolean
}): DeleteIntent {
  // A dialog already asking a question owns the whole keyboard. Answering it is the
  // only thing Delete should be able to do, and that decision belongs to the dialog.
  if (opts.confirmPending) return { action: 'none', reason: 'confirm-pending' }
  if (opts.overlayOpen) return { action: 'none', reason: 'overlay' }
  // The list row is a <button>, and the pane beside it is full of inputs. Delete in a
  // text field is a text edit, never a command: stealing it deletes a character the
  // user was aiming at, or worse, the entry behind the field.
  if (opts.typing) return { action: 'none', reason: 'editing' }
  if (!opts.selectedId) return { action: 'none', reason: 'no-selection' }
  return opts.inTrash ? { action: 'purge', id: opts.selectedId } : { action: 'trash', id: opts.selectedId }
}
