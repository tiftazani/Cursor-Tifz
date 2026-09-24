import { describe, expect, it } from 'vitest'
// @ts-expect-error plain JS module loaded by the Chrome extension
import { entriesToOffer, emptyListMessage } from '../extension/crypto.js'

const vault = [
  { id: '1', name: 'Talentradar-my' },
  { id: '2', name: 'Ess Pelindo' },
  { id: '3', name: 'Peo Pelindo' },
  { id: '4', name: 'test 1' },
  { id: '5', name: 'tifta' },
]

// The popup used to fall back to the whole vault whenever the current site had no
// saved login, so every unrelated password was offered on every site.
describe('popup offers only the current site', () => {
  it('shows nothing from the vault when the site has no saved login', () => {
    expect(entriesToOffer({ query: '', siteMatches: [], searchedEntries: vault })).toEqual([])
  })

  it('shows only the site matches when it has some', () => {
    const site = [vault[1]]
    expect(entriesToOffer({ query: '', siteMatches: site, searchedEntries: vault })).toEqual(site)
  })

  it('searches the whole vault only when the user typed something', () => {
    expect(entriesToOffer({ query: 'pelindo', siteMatches: [], searchedEntries: vault })).toEqual(vault)
  })

  it('says why the list is empty instead of "Tidak ada hasil"', () => {
    expect(emptyListMessage({ hasUrl: true, query: '' })).toBe('Belum ada login tersimpan untuk situs ini')
    expect(emptyListMessage({ hasUrl: true, query: 'zzz' })).toBe('Tidak ada hasil')
  })
})
