import type { Entry } from '../types'
import { newId } from './id'
import { hostFromUrl, isAndroidAppUrl } from './match'

export const SHEET_HEADERS = ['name', 'type', 'url', 'username', 'password', 'app', 'notes', 'totp', 'tags'] as const

export function detectCsvDelimiter(text: string): ',' | ';' | '\t' {
  // Look at the first few non-empty lines and pick the delimiter that shows up in
  // the most of them. The old version read only the FIRST non-empty line, which on
  // an Excel or Sheets export from an Indonesian locale is a title row ("Passwords-data")
  // with no delimiter at all: every count came out 0, the fallback ',' won, and a
  // semicolon file imported as 0 entries with no error. Counting across lines also
  // survives a semicolon inside a value (Kunci's own export joins tags with ';').
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .slice(0, 10)
  if (!lines.length) return ','
  const delim = [',', ';', '\t'] as const
  let best: ',' | ';' | '\t' = ','
  let bestLines = -1
  let bestTotal = -1
  for (const d of delim) {
    let onLines = 0
    let total = 0
    for (const line of lines) {
      const n = line.split(d).length - 1
      if (n > 0) onLines++
      total += n
    }
    if (onLines > bestLines || (onLines === bestLines && total > bestTotal)) {
      best = d
      bestLines = onLines
      bestTotal = total
    }
  }
  return best
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

/** A name that is one long credential or a raw url is never usable as a label. */
function unusableName(raw: string): boolean {
  if (!raw) return true
  if (raw.includes('://')) return true
  if (raw.includes('==')) return true
  return raw.length > 40 && !raw.includes(' ')
}

/**
 * A readable name for a row.
 *
 * Most rows already have a good name and must keep it exactly. Only a name that
 * is unusable gets replaced. Chrome's Android export writes the whole base64
 * login url into the name column when the name is empty, which showed up as a
 * wall of base64 with the account buried in the middle.
 */
function displayName(rawName: string, url: string): string {
  if (!unusableName(rawName)) return rawName
  const host = hostFromUrl(rawName) ?? hostFromUrl(url)
  if (host) return host
  return rawName
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

const NAME_COLS = ['name', 'title', 'nama']
const URL_COLS = ['url', 'uri', 'website', 'situs', 'login_uri', 'login uri']
const USER_COLS = ['username', 'user', 'pengguna', 'login_username', 'login username']
const PASS_COLS = ['password', 'pass', 'kata sandi', 'katasandi', 'login_password', 'login password']

/**
 * Finds the real header row.
 *
 * Exports from Excel and Google Sheets often put a title row above the header:
 * a real file of the user's had "Passwords-data" in A1 and the actual header on
 * row 2. Assuming row 1 was the header found no columns at all, so every data row
 * failed the "is this row empty" check and the import returned 0 entries with no
 * error — the file looked imported and nothing arrived.
 *
 * A header is recognised by naming at least one identity column and one secret
 * column, so a title row or a block of notes cannot be mistaken for it.
 */
export function headerRowIndex(rows: string[][]): number {
  const limit = Math.min(rows.length, 10)
  for (let i = 0; i < limit; i++) {
    const header = rows[i]!.map((h) => h.trim().toLowerCase())
    const has = (names: string[]) => header.some((h) => names.includes(h))
    if (has(NAME_COLS) && (has(URL_COLS) || has(USER_COLS) || has(PASS_COLS))) return i
  }
  return -1
}

export function entriesFromRows(rows: string[][], now = Date.now()): Entry[] {
  const headerAt = headerRowIndex(rows)
  if (headerAt < 0) return []
  const header = rows[headerAt]!.map((h) => h.trim())
  const nameI = col(header, NAME_COLS)
  const urlI = col(header, URL_COLS)
  const userI = col(header, USER_COLS)
  const passI = col(header, PASS_COLS)
  const notesI = col(header, ['notes', 'note', 'catatan'])
  const totpI = col(header, ['totp', 'login_totp', 'otp'])
  const appI = col(header, ['app', 'application', 'aplikasi', 'appname'])
  const typeI = col(header, ['type', 'tipe'])
  const tagsI = col(header, ['tags', 'tag', 'label'])

  const out: Entry[] = []
  for (const row of rows.slice(headerAt + 1)) {
    const name = displayName(at(row, nameI), at(row, urlI)) || at(row, appI) || 'Tanpa nama'
    const url = at(row, urlI)
    // Android app logins are dropped, not imported. Chrome's Android export
    // writes them as android://<base64 credential>@<package>/, which is not a
    // website: it cannot be autofilled, opened, or grouped. They were the bulk
    // of the unreadable entries in the summary.
    if (isAndroidAppUrl(url)) continue
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
    // The declared type wins. The heuristics used to sit in the same `else if` chain
    // AHEAD of some declared values, so a row that said `login` with no username was
    // reclassified: `login,,,Pw12345678!` became `password`, and `login` plus an app
    // name became `app`. Those rows are exactly what Kunci's own sheet export writes
    // (sheetRowFromEntry emits ["Tanpa URL","login","","","Pw…"]), so a round trip
    // through .csv or .xlsx silently changed the entry type.
    if (declared === 'note' || declared === 'catatan') type = 'note'
    else if (declared === 'totp' || declared === 'otp') type = 'totp'
    else if (declared === 'app' || declared === 'aplikasi') type = 'app'
    else if (declared === 'password' || declared === 'sandi') type = 'password'
    else if (declared === 'login' || declared === 'masuk') type = 'login'
    else if (appName && !url) type = 'app'
    else if (!username && password && !url) type = 'password'
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
