import { describe, expect, it } from 'vitest'
import { deleteIntent } from '../src/lib/delete-key'

const base = { selectedId: 'e1', inTrash: false, typing: false, overlayOpen: false, confirmPending: false }

describe('delete key intent', () => {
  it('sends the selected entry to the trash', () => {
    expect(deleteIntent(base)).toEqual({ action: 'trash', id: 'e1' })
  })

  it('purges instead of trashing while the trash filter is showing', () => {
    // In the trash, delete has to mean the permanent one, or the key could never
    // finish the job the user is looking at.
    expect(deleteIntent({ ...base, inTrash: true })).toEqual({ action: 'purge', id: 'e1' })
  })

  it('does nothing when no entry is selected', () => {
    expect(deleteIntent({ ...base, selectedId: null })).toEqual({ action: 'none', reason: 'no-selection' })
  })

  it('leaves the key alone while the user is typing in a field', () => {
    // The pane is full of inputs. Stealing Delete there deletes the character the user
    // aimed at, or the entry behind the field.
    expect(deleteIntent({ ...base, typing: true })).toEqual({ action: 'none', reason: 'editing' })
  })

  it('leaves the key alone while a panel owns the keyboard', () => {
    expect(deleteIntent({ ...base, overlayOpen: true })).toEqual({ action: 'none', reason: 'overlay' })
  })

  it('never deletes behind a confirmation that is already on screen', () => {
    // A dialog is waiting for an answer; a second destructive action must not fire.
    expect(deleteIntent({ ...base, confirmPending: true })).toEqual({ action: 'none', reason: 'confirm-pending' })
    expect(deleteIntent({ ...base, inTrash: true, confirmPending: true })).toEqual({ action: 'none', reason: 'confirm-pending' })
  })

  it('prefers the dialog guard over every other skip reason', () => {
    // Ordering matters: with both a dialog and an input in play, the reason reported
    // has to be the one that actually stopped the action.
    expect(deleteIntent({ ...base, typing: true, confirmPending: true })).toEqual({ action: 'none', reason: 'confirm-pending' })
  })
})
