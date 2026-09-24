import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_CLOUD_URL, isAllowedKunciOrigin, LOCAL_APP_ORIGINS } from '../src/lib/allowed-origins'

const root = join(__dirname, '..')

describe('cloud origin allowlist', () => {
  it('allows the site host and local Kunci tabs', () => {
    expect(isAllowedKunciOrigin('https://kunci.tiftazani-cuciin.workers.dev', 'kunci.tiftazani-cuciin.workers.dev')).toBe(true)
    expect(isAllowedKunciOrigin('http://127.0.0.1:8780', 'kunci.tiftazani-cuciin.workers.dev')).toBe(true)
    expect(isAllowedKunciOrigin('http://localhost:5173', 'kunci.tiftazani-cuciin.workers.dev')).toBe(true)
    for (const origin of LOCAL_APP_ORIGINS) {
      expect(isAllowedKunciOrigin(origin, 'kunci.tiftazani-cuciin.workers.dev')).toBe(true)
    }
  })

  it('allows any localhost HTTP port', () => {
    expect(isAllowedKunciOrigin('http://127.0.0.1:9999', 'kunci.tiftazani-cuciin.workers.dev')).toBe(true)
  })

  it('rejects a random website', () => {
    expect(isAllowedKunciOrigin('https://evil.example', 'kunci.tiftazani-cuciin.workers.dev')).toBe(false)
  })

  it('has no stale Netlify host left in the shipped sources', () => {
    // The old host is dead; a leftover copy silently breaks the helper and extension.
    const files = [
      'src/lib/allowed-origins.ts',
      'extension/background.js',
      'extension/content.js',
      'extension/crypto.js',
      'helper/daemon.mjs',
      'vite.config.ts',
    ]
    for (const f of files) {
      expect(readFileSync(join(root, f), 'utf8'), f).not.toContain('kunci-tifta.netlify.app')
    }
    expect(DEFAULT_CLOUD_URL).toContain('workers.dev')
  })
})
