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

  it('honours the declared type on a round trip through the sheet', async () => {
    // sheetRowFromEntry writes ["Tanpa URL","login","","","Pw…"] for a login with no
    // URL or username. The importer's heuristics used to run before the declared
    // value in the same else-if chain, so that row came back as `password`, and a
    // login with an app name came back as `app`: a round trip through .csv or .xlsx
    // silently changed the entry type.
    const noUrl: Entry = login({ id: '4', name: 'Tanpa URL', url: undefined, username: undefined, password: 'Pw12345678!' })
    const back = await entriesFromXlsx(entriesToXlsx([noUrl]), 5)
    expect(back[0]?.type).toBe('login')

    const app = login({ id: '5', name: 'App Mac', type: 'app', appName: 'Mail', url: undefined })
    const backApp = await entriesFromXlsx(entriesToXlsx([app]), 6)
    expect(backApp[0]?.type).toBe('app')
  })

  it('reads an xlsx whose sizes live in the central directory', async () => {
    // A streaming zip writer sets bit 3 and leaves the local header's size fields at
    // zero, putting the real sizes in a data descriptor after the data. Reading the
    // local header then gave compSize 0, the loop stopped on the first file, and the
    // import threw an Error with an empty message that BackupView showed as an empty
    // alert box. The fixture is built here so no binary blob is committed.
    const files = [
      { name: 'xl/workbook.xml', data: new TextEncoder().encode('<workbook/>') },
      { name: 'xl/worksheets/sheet1.xml', data: new TextEncoder().encode('<sheetData/>') },
    ]
    const bytes = zipWithDescriptors(files)
    expect(bytes[6]! & 0x08).toBe(0x08) // bit 3 set: sizes are in the descriptor
    const entries = await entriesFromXlsx(bytes, 7)
    expect(entries).toEqual([])
  })
})

/**
 * Minimal zip with bit 3 set and zeroed local sizes, the way a streaming writer
 * emits it. Files are stored (method 0) so the test needs no compressor.
 */
function zipWithDescriptors(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const locals: number[] = []
  const centrals: number[] = []
  const u16 = (n: number) => [n & 0xff, (n >> 8) & 0xff]
  const u32 = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff]
  let offset = 0
  for (const f of files) {
    const name = [...new TextEncoder().encode(f.name)]
    locals.push(
      ...[0x50, 0x4b, 0x03, 0x04],
      ...u16(20),
      ...u16(0x0008), // bit 3: data descriptor follows
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0), // crc: unknown at write time
      ...u32(0), // compSize: 0 in the local header
      ...u32(0), // uncompSize: 0 in the local header
      ...u16(name.length),
      ...u16(0),
      ...name,
      ...f.data,
      // data descriptor
      ...[0x50, 0x4b, 0x07, 0x08],
      ...u32(0),
      ...u32(f.data.length),
      ...u32(f.data.length),
    )
    centrals.push(
      ...[0x50, 0x4b, 0x01, 0x02],
      ...u16(20),
      ...u16(20),
      ...u16(0x0008),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(f.data.length), // the central directory carries the real size
      ...u32(f.data.length),
      ...u16(name.length),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(offset),
      ...name,
    )
    offset = locals.length
  }
  const centralStart = locals.length
  const out = [...locals, ...centrals]
  out.push(
    ...[0x50, 0x4b, 0x05, 0x06],
    ...u16(0),
    ...u16(0),
    ...u16(files.length),
    ...u16(files.length),
    ...u32(centrals.length),
    ...u32(centralStart),
    ...u16(0),
  )
  return new Uint8Array(out)
}
