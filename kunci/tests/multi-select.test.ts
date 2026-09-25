import { describe, expect, it } from 'vitest'
import {
  bulkDeleteIntent,
  clickMode,
  keptSelection,
  purgeQuestion,
  rangeSelection,
  selectionLabel,
  toggleSelection,
  trashSummary,
} from '../src/lib/multi-select'

const visible = ['a', 'b', 'c', 'd', 'e']

describe('selecting more than one entry', () => {
  it('treats a plain click as a plain click', () => {
    // Shift and the command key are what turn a click into a selection gesture. A
    // plain click must keep opening the entry, or the list stops working normally.
    expect(clickMode({ shiftKey: false, metaKey: false, ctrlKey: false })).toBe('plain')
  })

  it('reads shift as a range and the command key as a toggle', () => {
    expect(clickMode({ shiftKey: true, metaKey: false, ctrlKey: false })).toBe('range')
    expect(clickMode({ shiftKey: false, metaKey: true, ctrlKey: false })).toBe('add')
    // Windows and Linux use Ctrl for the same gesture.
    expect(clickMode({ shiftKey: false, metaKey: false, ctrlKey: true })).toBe('add')
  })

  it('extends a range downwards and upwards, inclusive of both ends', () => {
    expect(rangeSelection(visible, 'b', 'd')).toEqual(['b', 'c', 'd'])
    expect(rangeSelection(visible, 'd', 'b')).toEqual(['b', 'c', 'd'])
  })

  it('takes the range from the visible order, not the vault order', () => {
    // The list is filtered by search. A range that walked the whole vault would sweep
    // in rows the user cannot see, which is how people lose entries they never picked.
    const searched = ['a', 'd', 'e']
    expect(rangeSelection(searched, 'a', 'e')).toEqual(['a', 'd', 'e'])
  })

  it('makes the first shift-click the anchor when there is none', () => {
    expect(rangeSelection(visible, null, 'c')).toEqual(['c'])
    // An anchor that is no longer on screen (filtered out) cannot define a range.
    expect(rangeSelection(visible, 'zz', 'c')).toEqual(['c'])
  })

  it('toggles one row without disturbing the rest', () => {
    expect(toggleSelection(['a', 'b'], 'c')).toEqual(['a', 'b', 'c'])
    expect(toggleSelection(['a', 'b', 'c'], 'b')).toEqual(['a', 'c'])
  })

  it('drops ids that are no longer on screen', () => {
    // Switching filter or clearing the search must not leave a hidden entry selected,
    // or the next bulk delete would reach a row the user cannot see.
    expect(keptSelection(['a', 'c', 'zz'], visible)).toEqual(['a', 'c'])
    expect(keptSelection(['a', 'b'], [])).toEqual([])
  })
})

describe('deleting a whole selection', () => {
  it('trashes a group without asking', () => {
    // Recoverable, and asking once per row would make clearing twenty rows unusable.
    expect(bulkDeleteIntent({ ids: ['a', 'b'], inTrash: false, overlayOpen: false }))
      .toEqual({ action: 'trash', ids: ['a', 'b'] })
  })

  it('purges a group in the trash', () => {
    expect(bulkDeleteIntent({ ids: ['a'], inTrash: true, overlayOpen: false }))
      .toEqual({ action: 'purge', ids: ['a'] })
  })

  it('never treats an empty selection as delete-everything', () => {
    // The dangerous reading of an empty bulk action is "all of it".
    expect(bulkDeleteIntent({ ids: [], inTrash: false, overlayOpen: false }))
      .toEqual({ action: 'none', reason: 'empty' })
    expect(bulkDeleteIntent({ ids: [], inTrash: true, overlayOpen: false }))
      .toEqual({ action: 'none', reason: 'empty' })
  })

  it('stands down while a panel owns the keyboard', () => {
    expect(bulkDeleteIntent({ ids: ['a'], inTrash: false, overlayOpen: true }))
      .toEqual({ action: 'none', reason: 'overlay' })
  })

  it('always names the count in a permanent delete', () => {
    expect(purgeQuestion(7)).toContain('7 entri')
    expect(purgeQuestion(1)).toContain('1 entri')
  })

  it('reports the selection and summarises the trash in words', () => {
    expect(selectionLabel(3)).toBe('3 entri dipilih')
    expect(trashSummary(1, 'agoda.com')).toBe('"agoda.com" masuk sampah.')
    expect(trashSummary(4, 'agoda.com')).toBe('4 entri masuk sampah.')
  })
})
