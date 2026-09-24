import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(__dirname, '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

// The extension version is written down in several places by hand. Chrome only reloads
// an unpacked extension when manifest.version changes, so a stale copy anywhere means
// the user keeps running the old code without knowing.
const manifest = JSON.parse(read('extension/manifest.json')) as { version: string }

describe('extension version is consistent', () => {
  it('matches extension/VERSION', () => {
    expect(read('extension/VERSION').trim()).toBe(manifest.version)
  })

  it('matches the version the helper script demands', () => {
    const script = read('scripts/extension-status.mjs')
    const need = script.match(/const NEED = '([^']+)'/)?.[1]
    expect(need).toBe(manifest.version)
  })

  it('is the only version string left in the docs and views', () => {
    const files = ['README.md', 'HANDOFF.md', 'src/views/AutofillView.tsx']
    for (const f of files) {
      const hits = [...read(f).matchAll(/\b1\.\d+\.\d+\b/g)].map((m) => m[0]).filter((v) => v !== manifest.version)
      expect(hits, `${f} still mentions an old extension version: ${JSON.stringify(hits)}`).toEqual([])
    }
  })

  it('leaves no hardcoded version in a view, only the injected one', () => {
    // AppShell shipped "Ringkasan · 1.3" for weeks while the manifest moved on.
    // Views must read __KUNCI_VERSION__ (baked from extension/VERSION) instead.
    const shell = read('src/views/AppShell.tsx')
    expect(shell).toContain('__KUNCI_VERSION__')
    expect(shell).not.toMatch(/Ringkasan · 1\.\d/)
    const daemon = read('helper/daemon.mjs')
    expect(daemon).toContain('extensionOnDisk().extensionVersion')
    expect(daemon).not.toMatch(/uiRevision: [^,\n]*'1\.\d'/)
  })
})
