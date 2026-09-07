import { WORDLIST } from './wordlist'

export interface GeneratorOptions {
  length: number
  upper: boolean
  lower: boolean
  digits: boolean
  symbols: boolean
  excludeAmbiguous: boolean
  mode: 'random' | 'passphrase'
  words: number
  separator: string
  capitalize: boolean
  numberSuffix: boolean
}

export const DEFAULT_GENERATOR: GeneratorOptions = {
  length: 20,
  upper: true,
  lower: true,
  digits: true,
  symbols: true,
  excludeAmbiguous: true,
  mode: 'random',
  words: 5,
  separator: '-',
  capitalize: false,
  numberSuffix: true,
}

const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const DIGITS = '0123456789'
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.?'
const AMBIGUOUS = /[O0Il1|`]/g

export function randomInt(max: number): number {
  if (max <= 0) throw new Error('max must be > 0')
  const buf = new Uint32Array(1)
  const limit = Math.floor(0x100000000 / max) * max
  let x = 0
  do {
    crypto.getRandomValues(buf)
    x = buf[0]!
  } while (x >= limit)
  return x % max
}

export function pick<T>(items: readonly T[]): T {
  if (items.length === 0) throw new Error('empty')
  return items[randomInt(items.length)]!
}

function charsetFrom(options: GeneratorOptions): string {
  let set = ''
  if (options.lower) set += LOWER
  if (options.upper) set += UPPER
  if (options.digits) set += DIGITS
  if (options.symbols) set += SYMBOLS
  if (options.excludeAmbiguous) set = set.replace(AMBIGUOUS, '')
  return [...new Set(set)].join('')
}

export function generatePassword(options: GeneratorOptions = DEFAULT_GENERATOR): string {
  if (options.mode === 'passphrase') return generatePassphrase(options)
  const charset = charsetFrom(options)
  if (!charset) throw new Error('Pilih setidaknya satu jenis karakter')
  const length = Math.min(128, Math.max(4, options.length))
  const required: string[] = []
  const groups = [
    options.lower ? LOWER : '',
    options.upper ? UPPER : '',
    options.digits ? DIGITS : '',
    options.symbols ? SYMBOLS : '',
  ]
    .map((g) => (options.excludeAmbiguous ? g.replace(AMBIGUOUS, '') : g))
    .filter(Boolean)
  for (const g of groups) required.push(pick([...g]))
  const chars: string[] = []
  for (let i = 0; i < length; i++) chars.push(pick([...charset]))
  for (let i = 0; i < required.length && i < chars.length; i++) chars[i] = required[i]!
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    const tmp = chars[i]!
    chars[i] = chars[j]!
    chars[j] = tmp
  }
  return chars.join('')
}

export function generatePassphrase(options: GeneratorOptions = DEFAULT_GENERATOR): string {
  const count = Math.min(12, Math.max(3, options.words))
  const words: string[] = []
  for (let i = 0; i < count; i++) {
    let w = pick(WORDLIST)
    if (options.capitalize) w = w.charAt(0).toUpperCase() + w.slice(1)
    words.push(w)
  }
  let phrase = words.join(options.separator || '-')
  if (options.numberSuffix) phrase += String(randomInt(90) + 10)
  return phrase
}

export function generateMany(n: number, options: GeneratorOptions = DEFAULT_GENERATOR): string[] {
  return Array.from({ length: n }, () => generatePassword(options))
}
