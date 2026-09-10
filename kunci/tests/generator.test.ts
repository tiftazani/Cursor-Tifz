import { describe, expect, it } from 'vitest'
import { generatePassword, generatePassphrase, randomInt, DEFAULT_GENERATOR } from '../src/lib/generator'
import { WORDLIST } from '../src/lib/wordlist'

describe('generator', () => {
  it('draws unbiased integers in range', () => {
    const seen = new Set<number>()
    for (let i = 0; i < 200; i++) seen.add(randomInt(5))
    expect(seen.size).toBeGreaterThan(1)
    expect([...seen].every((n) => n >= 0 && n < 5)).toBe(true)
  })

  it('honors charset and length', () => {
    const password = generatePassword({ ...DEFAULT_GENERATOR, length: 24, symbols: false, mode: 'random' })
    expect(password).toHaveLength(24)
    expect(/^[A-Za-z0-9]+$/.test(password)).toBe(true)
  })

  it('builds a passphrase from the wordlist', () => {
    const phrase = generatePassphrase({ ...DEFAULT_GENERATOR, mode: 'passphrase', words: 4, numberSuffix: false, separator: '-' })
    const parts = phrase.split('-')
    expect(parts).toHaveLength(4)
    expect(parts.every((w) => WORDLIST.includes(w))).toBe(true)
  })

  it('has a large enough wordlist', () => {
    expect(new Set(WORDLIST).size).toBeGreaterThan(400)
  })
})
