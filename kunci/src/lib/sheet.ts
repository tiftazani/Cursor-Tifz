import type { Entry } from '../types'
import { decodeSpreadsheetText, entriesFromCsv } from './csv'
import { entriesFromXlsx } from './xlsx'

export async function entriesFromPlainFile(filename: string, bytes: Uint8Array, now = Date.now()): Promise<Entry[]> {
  const lower = filename.toLowerCase()
  const isZip = bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b
  if (lower.endsWith('.xlsx') || lower.endsWith('.xlsm') || isZip) {
    return entriesFromXlsx(bytes, now)
  }
  if (lower.endsWith('.xls') && !isZip) {
    throw new Error('File .xls lama tidak didukung. Di Excel pilih File → Save As → CSV atau Excel Workbook (.xlsx).')
  }
  return entriesFromCsv(decodeSpreadsheetText(bytes), now)
}
