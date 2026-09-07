import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = dirname(fileURLToPath(import.meta.url))
const publicDir = join(dir, '../public')
const extensionDir = join(dir, '../extension')

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

function pngFromRaw(width, height, raw) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function pngSquare(size, paint) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  let i = 0
  for (let y = 0; y < size; y++) {
    raw[i++] = 0
    for (let x = 0; x < size; x++) {
      const p = paint(x, y, size)
      raw[i++] = p[0]
      raw[i++] = p[1]
      raw[i++] = p[2]
      raw[i++] = p[3]
    }
  }
  return pngFromRaw(size, size, raw)
}

const BG = [10, 13, 18, 255]
const TEAL = [62, 224, 195, 255]

function keyPaint(px, py, transparentOutside) {
  const dx = px - 16
  const dy = py - 16
  if (transparentOutside && Math.max(Math.abs(dx), Math.abs(dy)) > 14.5) return [0, 0, 0, 0]
  const r = Math.hypot(px - 13, py - 16)
  if (r > 5.2 && r < 7.4) return TEAL
  if (px > 16 && px < 26 && py > 14.6 && py < 17.6) return TEAL
  if (px > 23.2 && px < 25.6 && py > 14.6 && py < 21) return TEAL
  if (px > 20.4 && px < 22.8 && py > 14.6 && py < 19.4) return TEAL
  return BG
}

function opaqueIconPaint(x, y, size) {
  return keyPaint((x / size) * 32, (y / size) * 32, false)
}

function extensionIconPaint(x, y, size) {
  return keyPaint((x / size) * 32, (y / size) * 32, true)
}

function splashPng(width, height) {
  const icon = Math.round(Math.min(width, height) * 0.2)
  const ox = Math.round((width - icon) / 2)
  const oy = Math.round((height - icon) / 2)
  const raw = Buffer.alloc((width * 4 + 1) * height)
  let i = 0
  for (let y = 0; y < height; y++) {
    raw[i++] = 0
    for (let x = 0; x < width; x++) {
      let p = BG
      if (x >= ox && x < ox + icon && y >= oy && y < oy + icon) {
        p = opaqueIconPaint(x - ox, y - oy, icon)
      }
      raw[i++] = p[0]
      raw[i++] = p[1]
      raw[i++] = p[2]
      raw[i++] = p[3]
    }
  }
  return pngFromRaw(width, height, raw)
}

mkdirSync(publicDir, { recursive: true })
mkdirSync(extensionDir, { recursive: true })

writeFileSync(join(extensionDir, 'icon16.png'), pngSquare(16, extensionIconPaint))
writeFileSync(join(extensionDir, 'icon48.png'), pngSquare(48, extensionIconPaint))
writeFileSync(join(extensionDir, 'icon128.png'), pngSquare(128, extensionIconPaint))

writeFileSync(join(publicDir, 'apple-touch-icon.png'), pngSquare(180, opaqueIconPaint))
writeFileSync(join(publicDir, 'icon-192.png'), pngSquare(192, opaqueIconPaint))
writeFileSync(join(publicDir, 'icon-512.png'), pngSquare(512, opaqueIconPaint))

// iPhone 15 / 16 Pro Max @3x (430×932 pt) and 15 / 16 Pro @3x (393×852 pt)
writeFileSync(join(publicDir, 'splash-1290x2796.png'), splashPng(1290, 2796))
writeFileSync(join(publicDir, 'splash-2796x1290.png'), splashPng(2796, 1290))
writeFileSync(join(publicDir, 'splash-1179x2556.png'), splashPng(1179, 2556))
writeFileSync(join(publicDir, 'splash-2556x1179.png'), splashPng(2556, 1179))

console.log('icons and iOS splash screens written')
