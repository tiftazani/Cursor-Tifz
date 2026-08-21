import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = dirname(fileURLToPath(import.meta.url))

function crc32(buf) {
  let c = ~0
  for (const b of buf) {
    c ^= b
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const t = Buffer.from(type)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const payload = Buffer.concat([t, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(payload))
  return Buffer.concat([len, payload, crc])
}

function png(size, paint) {
  const raw = []
  for (let y = 0; y < size; y++) {
    raw.push(0)
    for (let x = 0; x < size; x++) {
      raw.push(...paint(x, y, size))
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.from(raw))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function paint(x, y, size) {
  const n = (v) => (v / size) * 32
  const px = n(x)
  const py = n(y)
  const dx = px - 16
  const dy = py - 16
  if (Math.max(Math.abs(dx), Math.abs(dy)) > 14.5) return [0, 0, 0, 0]
  const bg = [18, 24, 32, 255]
  const teal = [94, 224, 197, 255]
  const cx = 13
  const cy = 16
  const r = Math.hypot(px - cx, py - cy)
  if (r > 5.2 && r < 7.4) return teal
  if (px > 16 && px < 26 && py > 14.6 && py < 17.6) return teal
  if (px > 23.2 && px < 25.6 && py > 14.6 && py < 21) return teal
  if (px > 20.4 && px < 22.8 && py > 14.6 && py < 19.4) return teal
  return bg
}

const out = join(dir, '../extension')
writeFileSync(join(out, 'icon16.png'), png(16, paint))
writeFileSync(join(out, 'icon48.png'), png(48, paint))
writeFileSync(join(out, 'icon128.png'), png(128, paint))
console.log('icons written')
