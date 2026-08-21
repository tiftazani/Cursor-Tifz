import type { Entry } from '../types'
import { newId } from './id'

export function parseCsv(text: string): string[][] {
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
    } else if (ch === ',') {
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

export function entriesFromCsv(text: string, now = Date.now()): Entry[] {
  const rows = parseCsv(text)
  if (rows.length < 2) return []
  const header = rows[0]!.map((h) => h.trim())
  const nameI = col(header, ['name', 'title', 'nama'])
  const urlI = col(header, ['url', 'uri', 'website', 'login_uri', 'login uri'])
  const userI = col(header, ['username', 'user', 'login_username', 'login username'])
  const passI = col(header, ['password', 'pass', 'login_password', 'login password'])
  const notesI = col(header, ['notes', 'note', 'catatan'])
  const totpI = col(header, ['totp', 'login_totp', 'otp'])
  const appI = col(header, ['app', 'application', 'aplikasi', 'appname'])
  const typeI = col(header, ['type', 'tipe'])

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
    let type: Entry['type'] = 'login'
    if (declared === 'note' || declared === 'catatan') type = 'note'
    else if (declared === 'totp' || declared === 'otp') type = 'totp'
    else if (appName && !url) type = 'app'
    else if (!username && password) type = 'password'
    else if (!password && notes && !username && !url) type = 'note'
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
      tags: [],
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

export function entriesToCsv(entries: Entry[]): string {
  const header = ['name', 'type', 'url', 'username', 'password', 'app', 'notes', 'totp', 'tags']
  const lines = [header.join(',')]
  for (const e of entries) {
    const cells = [
      e.name,
      e.type,
      e.url ?? '',
      e.username ?? '',
      e.password ?? '',
      e.appName ?? '',
      e.notes ?? '',
      e.totpSecret ?? '',
      e.tags.join(';'),
    ].map(csvEscape)
    lines.push(cells.join(','))
  }
  return lines.join('\n')
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}
