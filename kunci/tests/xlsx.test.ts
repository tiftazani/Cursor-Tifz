import { describe, expect, it } from 'vitest'
import { entriesFromCsv, entriesToCsv } from '../src/lib/csv'
import { entriesFromXlsx, entriesToXlsx } from '../src/lib/xlsx'
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

  it('detects xlsx from a file name and csv from text', async () => {
    const csv = new TextEncoder().encode(entriesToCsv([login({ id: '2' })]))
    const fromCsv = await entriesFromPlainFile('kunci.csv', csv, 3)
    expect(fromCsv[0]?.password).toBe('rahasia,ya')
    const xlsx = entriesToXlsx([login({ id: '3', name: 'X' })])
    const fromXlsx = await entriesFromPlainFile('kunci.xlsx', xlsx, 4)
    expect(fromXlsx[0]?.name).toBe('X')
  })
})
