import type { Entry } from '../types'
import { newId } from './id'

export const SHEET_HEADERS = ['name', 'type', 'url', 'username', 'password', 'app', 'notes', 'totp', 'tags'] as const

export function detectCsvDelimiter(text: string): ',' | ';' | '\t' {
  const line = (text.replace(/^\uFEFF/, '').split(/\r?\n/).find((l) => l.trim()) || '')
  const counts = {
    ',': (line.match(/,/g) || []).length,
    ';': (line.match(/;/g) || []).length,
    '\t': (line.match(/\t/g) || []).length,
  }
  if (counts['\t'] > counts[','] && counts['\t'] > counts[';']) return '\t'
  if (counts[';'] > counts[',']) return ';'
  return ','
}

export function parseCsv(text: string, delimiter?: ',' | ';' | '\t'): string[][] {
  const delim = delimiter || detectCsvDelimiter(text)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  const src = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else inQuotes = false
      } else cell += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delim) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell)
      cell = ''
      if (row.some((c) => c.length)) rows.push(row)
      row = []
    } else if (ch !== '\r') {
      cell += ch
    }
  }
  row.push(cell)
  if (row.some((c) => c.length)) rows.push(row)
  return rows
}

function col(header: string[], names: string[]): number {
  const wanted = names.map((n) => n.toLowerCase())
  return header.findIndex((h) => wanted.includes(h.trim().toLowerCase()))
}

function at(row: string[], index: number): string {
  if (index < 0) return ''
  return (row[index] ?? '').trim()
}

export function sheetRowFromEntry(entry: Entry): string[] {
  return [
    entry.name,
    entry.type,
    entry.url ?? '',
    entry.username ?? '',
    entry.password ?? '',
    entry.appName ?? '',
    entry.notes ?? '',
    entry.totpSecret ?? '',
    entry.tags.join(';'),
  ]
}

export function entriesFromRows(rows: string[][], now = Date.now()): Entry[] {
  if (rows.length < 2) return []
  const header = rows[0]!.map((h) => h.trim())
  const nameI = col(header, ['name', 'title', 'nama'])
  const urlI = col(header, ['url', 'uri', 'website', 'situs', 'login_uri', 'login uri'])
  const userI = col(header, ['username', 'user', 'pengguna', 'login_username', 'login username'])
  const passI = col(header, ['password', 'pass', 'kata sandi', 'katasandi', 'login_password', 'login password'])
  const notesI = col(header, ['notes', 'note', 'catatan'])
  const totpI = col(header, ['totp', 'login_totp', 'otp'])
  const appI = col(header, ['app', 'application', 'aplikasi', 'appname'])
  const typeI = col(header, ['type', 'tipe'])
  const tagsI = col(header, ['tags', 'tag', 'label'])

  const out: Entry[] = []
  for (const row of rows.slice(1)) {
    const name = at(row, nameI) || at(row, urlI) || at(row, appI) || 'Tanpa nama'
    const url = at(row, urlI)
    const username = at(row, userI)
    const password = at(row, passI)
    const notes = at(row, notesI)
    const totpSecret = at(row, totpI)
    const appName = at(row, appI)
    const declared = at(row, typeI).toLowerCase()
    const tags = at(row, tagsI)
      .split(/[;,]/)
      .map((t) => t.trim())
      .filter(Boolean)
    let type: Entry['type'] = 'login'
    if (declared === 'note' || declared === 'catatan') type = 'note'
    else if (declared === 'totp' || declared === 'otp') type = 'totp'
    else if (declared === 'app' || declared === 'aplikasi' || (appName && !url)) type = 'app'
    else if (declared === 'password' || (!username && password && !url)) type = 'password'
    else if (!password && notes && !username && !url) type = 'note'
    if (!username && !password && !url && !appName && !notes && !totpSecret) continue
    out.push({
      id: newId(),
      type,
      name,
      username: username || undefined,
      password: password || undefined,
      url: url || undefined,
      urls: [],
      appName: appName || undefined,
      notes: notes || undefined,
      totpSecret: totpSecret || undefined,
      tags,
      favorite: false,
      customFields: [],
      history: [],
      createdAt: now,
      updatedAt: now,
      passwordChangedAt: password ? now : undefined,
    })
  }
  return out
}

export function entriesFromCsv(text: string, now = Date.now()): Entry[] {
  return entriesFromRows(parseCsv(text), now)
}

export function entriesToCsv(entries: Entry[]): string {
  const lines = [SHEET_HEADERS.join(',')]
  for (const e of entries) {
    lines.push(sheetRowFromEntry(e).map(csvEscape).join(','))
  }
  return lines.join('\n')
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function decodeSpreadsheetText(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.slice(2))
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.slice(2))
  }
  return new TextDecoder('utf-8').decode(bytes)
}
