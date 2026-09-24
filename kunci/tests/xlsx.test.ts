import { describe, expect, it } from 'vitest'
import { entriesFromCsv, entriesToCsv, headerRowIndex } from '../src/lib/csv'
import { entriesFromXlsx, entriesToXlsx, parseSheetRows } from '../src/lib/xlsx'
import { entriesFromPlainFile } from '../src/lib/sheet'
import type { Entry } from '../src/types'

function login(partial: Partial<Entry>): Entry {
  return {
    id: '1',
    type: 'login',
    name: 'Mail',
    username: 'tif@x.com',
    password: 'rahasia,ya',
    url: 'https://mail.test',
    urls: [],
    tags: ['kerja'],
    favorite: false,
    customFields: [],
    history: [],
    createdAt: 1,
    updatedAt: 1,
    notes: 'baris\ndua',
    ...partial,
  }
}

describe('excel and csv portability', () => {
  it('round-trips entries through xlsx including commas and unicode', async () => {
    const source = [login({ name: 'Surel kerja', appName: 'Mail' })]
    const bytes = entriesToXlsx(source)
    expect(bytes[0]).toBe(0x50)
    expect(bytes[1]).toBe(0x4b)
    const back = await entriesFromXlsx(bytes, 99)
    expect(back).toHaveLength(1)
    expect(back[0]?.name).toBe('Surel kerja')
    expect(back[0]?.username).toBe('tif@x.com')
    expect(back[0]?.password).toBe('rahasia,ya')
    expect(back[0]?.notes).toBe('baris\ndua')
    expect(back[0]?.tags).toEqual(['kerja'])
  })

  it('imports semicolon CSV from Excel locales', () => {
    const text = 'nama;url;username;password\nNetflix;https://netflix.com;tif;secret'
    const entries = entriesFromCsv(text, 10)
    expect(entries[0]?.name).toBe('Netflix')
    expect(entries[0]?.username).toBe('tif')
  })

  it('keeps columns aligned when a row has a styled empty cell', () => {
    // Excel writes a formatted-but-empty cell self-closing: <c r="E3" s="7"/>.
    // Reading that as an open tag swallowed the next cell's closing tag and shifted
    // every later value one column left, so "Title" ended up under "URL".
    const xml =
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" s="2"/></row>' +
      '<row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2" t="s"><v>2</v></c></row>'
    const rows = parseSheetRows(xml, ['Title', 'URL', 'https://x.test'])
    expect(rows[0]).toEqual(['Title', ''])
    expect(rows[1]).toEqual(['URL', 'https://x.test'])
  })

  it('finds the header under a title row', () => {
    // A real export had "Passwords-data" in A1 and the header on row 2. Reading row
    // 1 as the header found no columns, and the file imported as 0 entries silently.
    const csv = [
      'Passwords-data',
      'Title,URL,Username,Password',
      'Amazon,https://www.amazon.com,t@x.com,sandi-1',
    ].join('\n')
    const entries = entriesFromCsv(csv, 1)
    expect(entries).toHaveLength(1)
    expect(entries[0]?.name).toBe('Amazon')
    expect(entries[0]?.username).toBe('t@x.com')
  })

  it('returns nothing when no row looks like a header', () => {
    expect(headerRowIndex([['catatan saja'], ['baris lain']])).toBe(-1)
    expect(entriesFromCsv('satu\ndua', 1)).toHaveLength(0)
  })

  it('detects xlsx from a file name and csv from text', async () => {
    const csv = new TextEncoder().encode(entriesToCsv([login({ id: '2' })]))
    const fromCsv = await entriesFromPlainFile('kunci.csv', csv, 3)
    expect(fromCsv[0]?.password).toBe('rahasia,ya')
    const xlsx = entriesToXlsx([login({ id: '3', name: 'X' })])
    const fromXlsx = await entriesFromPlainFile('kunci.xlsx', xlsx, 4)
    expect(fromXlsx[0]?.name).toBe('X')
  })
})
