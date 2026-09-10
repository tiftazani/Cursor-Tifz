import type { Entry } from '../types'
import { entriesFromRows, SHEET_HEADERS, sheetRowFromEntry } from './csv'

function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    c ^= data[i]!
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  return (c ^ 0xffffffff) >>> 0
}

function u16(n: number): Uint8Array {
  const b = new Uint8Array(2)
  new DataView(b.buffer).setUint16(0, n, true)
  return b
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setUint32(0, n, true)
  return b
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const file of files) {
    const name = new TextEncoder().encode(file.name)
    const crc = crc32(file.data)
    const local = concat([
      Uint8Array.of(0x50, 0x4b, 0x03, 0x04),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(file.data.length),
      u32(file.data.length),
      u16(name.length),
      u16(0),
      name,
      file.data,
    ])
    locals.push(local)
    centrals.push(
      concat([
        Uint8Array.of(0x50, 0x4b, 0x01, 0x02),
        u16(20),
        u16(20),
        u16(0x0800),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(file.data.length),
        u32(file.data.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ]),
    )
    offset += local.length
  }
  const central = concat(centrals)
  const eocd = concat([
    Uint8Array.of(0x50, 0x4b, 0x05, 0x06),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(central.length),
    u32(offset),
    u16(0),
  ])
  return concat([...locals, central, eocd])
}

function xmlEscape(value: string): string {
  let out = ''
  for (const ch of value) {
    const code = ch.charCodeAt(0)
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) continue
    if (ch === '&') out += '&amp;'
    else if (ch === '<') out += '&lt;'
    else if (ch === '>') out += '&gt;'
    else if (ch === '"') out += '&quot;'
    else out += ch
  }
  return out
}

function colLetter(index: number): string {
  let n = index + 1
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function inlineCell(row: number, col: number, value: string): string {
  const ref = `${colLetter(col)}${row}`
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`
}

export function entriesToXlsx(entries: Entry[]): Uint8Array {
  const rows = [SHEET_HEADERS, ...entries.map(sheetRowFromEntry)]
  const sheetRows = rows
    .map((row, r) => {
      const cells = row.map((cell, c) => inlineCell(r + 1, c, cell)).join('')
      return `<row r="${r + 1}">${cells}</row>`
    })
    .join('')
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Kunci" sheetId="1" r:id="rId1"/></sheets></workbook>`
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`
  const types = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`
  const enc = new TextEncoder()
  return zipStore([
    { name: '[Content_Types].xml', data: enc.encode(types) },
    { name: '_rels/.rels', data: enc.encode(rels) },
    { name: 'xl/workbook.xml', data: enc.encode(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(wbRels) },
    { name: 'xl/worksheets/sheet1.xml', data: enc.encode(sheet) },
  ])
}

function readU16(buf: Uint8Array, offset: number): number {
  return buf[offset]! | (buf[offset + 1]! << 8)
}

function readU32(buf: Uint8Array, offset: number): number {
  return (buf[offset]! | (buf[offset + 1]! << 8) | (buf[offset + 2]! << 16) | (buf[offset + 3]! << 24)) >>> 0
}

function bytesToBlobPart(data: Uint8Array): BlobPart {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('Browser ini tidak bisa membaca Excel terkompresi. Ekspor ulang sebagai CSV.')
  }
  const stream = new Blob([bytesToBlobPart(data)]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function unzip(buf: Uint8Array): Promise<Map<string, string>> {
  const files = new Map<string, string>()
  let i = 0
  while (i + 30 <= buf.length) {
    if (readU32(buf, i) !== 0x04034b50) break
    const method = readU16(buf, i + 8)
    const compSize = readU32(buf, i + 18)
    const nameLen = readU16(buf, i + 26)
    const extraLen = readU16(buf, i + 28)
    const name = new TextDecoder().decode(buf.slice(i + 30, i + 30 + nameLen))
    const start = i + 30 + nameLen + extraLen
    const stored = buf.slice(start, start + compSize)
    const data = method === 8 ? await inflateRaw(stored) : stored
    if (!name.endsWith('/')) files.set(name.replace(/\\/g, '/'), new TextDecoder().decode(data))
    i = start + compSize
  }
  return files
}

function colIndex(ref: string): number {
  const letters = ref.replace(/\d+/g, '')
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.toUpperCase().charCodeAt(0) - 64)
  return n - 1
}

function rowIndex(ref: string): number {
  return Number(ref.replace(/\D+/g, '')) - 1
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = []
  const sis = xml.match(/<si[\s>][\s\S]*?<\/si>/g) || []
  for (const si of sis) {
    const texts = [...si.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXmlEntities(m[1] || ''))
    out.push(texts.join(''))
  }
  return out
}

function parseSheetRows(xml: string, shared: string[]): string[][] {
  const grid = new Map<string, string>()
  let maxRow = 0
  let maxCol = 0
  const cells = xml.match(/<c\b[^>]*>[\s\S]*?<\/c>/g) || []
  for (const cell of cells) {
    const ref = cell.match(/\br="([A-Z]+\d+)"/)?.[1]
    if (!ref) continue
    const type = cell.match(/\bt="([^"]+)"/)?.[1] || ''
    let value = ''
    if (type === 'inlineStr') {
      value = [...cell.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXmlEntities(m[1] || '')).join('')
    } else if (type === 's') {
      const idx = Number(cell.match(/<v>([\s\S]*?)<\/v>/)?.[1] || '0')
      value = shared[idx] || ''
    } else {
      value = decodeXmlEntities(cell.match(/<v>([\s\S]*?)<\/v>/)?.[1] || '')
    }
    const r = rowIndex(ref)
    const c = colIndex(ref)
    maxRow = Math.max(maxRow, r)
    maxCol = Math.max(maxCol, c)
    grid.set(`${r}:${c}`, value)
  }
  const rows: string[][] = []
  for (let r = 0; r <= maxRow; r++) {
    const row: string[] = []
    for (let c = 0; c <= maxCol; c++) row.push(grid.get(`${r}:${c}`) || '')
    if (row.some((cell) => cell.trim())) rows.push(row)
  }
  return rows
}

export async function entriesFromXlsx(bytes: Uint8Array, now = Date.now()): Promise<Entry[]> {
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error('File bukan Excel .xlsx. Simpan ulang sebagai .xlsx atau CSV.')
  }
  const files = await unzip(bytes)
  const shared = parseSharedStrings(files.get('xl/sharedStrings.xml') || '')
  const sheet =
    files.get('xl/worksheets/sheet1.xml') ||
    [...files.entries()].find(([name]) => /xl\/worksheets\/sheet\d+\.xml$/.test(name))?.[1]
  if (!sheet) throw new Error('File Excel tidak berisi sheet yang bisa dibaca')
  return entriesFromRows(parseSheetRows(sheet, shared), now)
}
