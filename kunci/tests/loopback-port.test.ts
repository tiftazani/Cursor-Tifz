import { describe, expect, it } from 'vitest'
import { domainsMatch, entryMatchesPage, hostFromUrl } from '../src/lib/match'
import { sameSiteHost } from '../src/lib/login-outcome'
import {
  domainsMatch as extDomainsMatch,
  hostFromUrl as extHostFromUrl,
  matchesForUrl,
} from '../extension/crypto.js'
import { createContext, runInContext } from 'node:vm'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// The extension copy of login-outcome is a plain script for the page, so it is loaded
// the same way tests/login-outcome-parity.test.ts loads it.
const sandbox = createContext({ URL })
runInContext(readFileSync(join(import.meta.dirname, '..', 'extension/login-outcome.js'), 'utf8'), sandbox)
const extOutcome = (sandbox as { kunciLoginOutcome: Record<string, (a: string, b: string) => boolean> }).kunciLoginOutcome

// 127.0.0.1:5178 (situs lain) dan 127.0.0.1:8780 (aplikasi Kunci) itu dua aplikasi
// berbeda di mesin yang sama. Port adalah identitasnya, jadi login Kunci tidak boleh
// ditawarkan di situs lain yang kebetulan memakai loopback.
describe('loopback: port adalah bagian dari identitas situs', () => {
  it('hostFromUrl menyimpan port untuk loopback', () => {
    expect(hostFromUrl('http://127.0.0.1:5178/')).toBe('127.0.0.1:5178')
    expect(hostFromUrl('http://127.0.0.1:8780/#preview-ui')).toBe('127.0.0.1:8780')
    expect(hostFromUrl('http://localhost:3000/login')).toBe('localhost:3000')
    // Port default tidak muncul, jadi bentuk dengan dan tanpa ":80" tetap sama.
    expect(hostFromUrl('http://127.0.0.1/')).toBe('127.0.0.1')
    expect(hostFromUrl('http://127.0.0.1:80/')).toBe('127.0.0.1')
  })

  it('port berbeda bukan situs yang sama', () => {
    expect(domainsMatch('http://127.0.0.1:8780', 'http://127.0.0.1:5178')).toBe(false)
    expect(domainsMatch('http://localhost:3000', 'http://localhost:5173')).toBe(false)
    // Port yang sama tetap cocok, termasuk di path dalam.
    expect(domainsMatch('http://127.0.0.1:5178', 'http://127.0.0.1:5178/login')).toBe(true)
  })

  it('host non-loopback tidak berubah', () => {
    // Port eksplisit di situs biasa tetap diabaikan seperti sebelumnya.
    expect(hostFromUrl('https://example.com:8443/x')).toBe('example.com')
    expect(domainsMatch('https://example.com:8443', 'https://example.com')).toBe(true)
  })

  it('entri aplikasi Kunci tidak ditawarkan di situs loopback lain', () => {
    const entries = [
      { id: 'kunci', type: 'login', name: 'Aplikasi Kunci - Localhost', url: 'http://127.0.0.1:8780' },
      { id: 'lain', type: 'login', name: 'Situs Lain', url: 'http://127.0.0.1:5178' },
    ]
    const offered = entries.filter((e) => entryMatchesPage(e, 'http://127.0.0.1:5178/')).map((e) => e.id)
    expect(offered).toEqual(['lain'])
    expect(matchesForUrl(entries, 'http://127.0.0.1:5178/').map((e: { id: string }) => e.id)).toEqual(['lain'])
  })

  it('salinan ekstensi setuju', () => {
    for (const u of ['http://127.0.0.1:5178/', 'http://127.0.0.1:8780/', 'http://localhost:3000/', 'https://example.com:8443/']) {
      expect(extHostFromUrl(u)).toBe(hostFromUrl(u))
    }
    expect(extDomainsMatch('http://127.0.0.1:8780', 'http://127.0.0.1:5178')).toBe(false)
  })

  it('login yang berhasil di satu aplikasi loopback bukan bukti di aplikasi lain', () => {
    // Bar "Simpan login" hanya muncul setelah login dianggap berhasil. Kalau port
    // diabaikan, pindah dari 127.0.0.1:8780 ke 127.0.0.1:5178 terbaca sebagai
    // halaman yang sama dan bar itu muncul di situs yang tidak pernah login.
    expect(sameSiteHost('http://127.0.0.1:8780/#preview-ui', 'http://127.0.0.1:5178/')).toBe(false)
    expect(sameSiteHost('http://127.0.0.1:5178/login', 'http://127.0.0.1:5178/dashboard')).toBe(true)
    // Situs biasa tidak berubah: port diabaikan.
    expect(sameSiteHost('https://example.com:8443/a', 'https://example.com/b')).toBe(true)
    expect(extOutcome.sameSiteHost('http://127.0.0.1:8780/', 'http://127.0.0.1:5178/')).toBe(false)
    expect(extOutcome.sameAuthPage('http://127.0.0.1:8780/x', 'http://127.0.0.1:5178/x')).toBe(false)
  })

  it('nama entri loopback tidak menyeberang port', () => {
    // Entri tanpa URL hanya punya nama. Di loopback nama polos seperti "localhost"
    // tidak menyebut port, jadi tidak ada aplikasi lokal yang boleh diklaimnya.
    const named = [
      { id: 'a', type: 'login', name: '127.0.0.1', url: '' },
      { id: 'b', type: 'login', name: 'localhost', url: '' },
      { id: 'c', type: 'login', name: 'localhost', url: 'http://localhost:3000/' },
    ]
    expect(matchesForUrl(named, 'http://127.0.0.1:5178/').map((e: { id: string }) => e.id)).toEqual([])
    expect(matchesForUrl(named, 'http://localhost:5178/').map((e: { id: string }) => e.id)).toEqual([])
    // Yang punya URL tetap cocok di portnya sendiri.
    expect(matchesForUrl(named, 'http://localhost:3000/').map((e: { id: string }) => e.id)).toEqual(['c'])
  })
})
