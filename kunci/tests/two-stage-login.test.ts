import { describe, expect, it } from 'vitest'
import { applyLoginCapture, decideLoginSave, isSharedPasswordStage } from '../src/lib/capture'
import { findDuplicateClusters, tenantOf } from '../src/lib/duplicates'
import {
  applyLoginCapture as extApply,
  decideLoginSave as extDecide,
} from '../extension/crypto.js'

/**
 * talentradar-my.app asks for a shared password first (one password works for every
 * member), then a company code and a personal username and password. One vault entry
 * cannot hold two passwords, so Kunci stores the personal pair and keeps the company
 * as a field, which is what tells two otherwise identical rows apart.
 * The company box itself is read in tests/tenant-field.test.ts.
 */
function field(over: Record<string, unknown>) {
  return {
    tag: 'input',
    type: 'text',
    name: '',
    id: '',
    autocomplete: '',
    placeholder: '',
    ariaLabel: '',
    ...over,
  }
}

function form(fields: ReturnType<typeof field>[], buttons = ['Masuk']): FormSnapshot {
  return {
    id: '',
    name: '',
    action: '/masuk',
    method: 'post',
    fields,
    buttons,
    pageUrl: 'https://talentradar-my.app/masuk',
  }
}

describe('two-stage login: shared password, then a personal account', () => {
  it('does not keep the shared password stage as a login of its own', () => {
    const capture = { url: 'https://talentradar-my.app/masuk', username: '', password: 'sama-untuk-semua', missingTenant: true }
    expect(isSharedPasswordStage(capture)).toBe(true)
    expect(decideLoginSave([], capture)).toEqual({ action: 'skip', reason: 'shared-password' })
    // The extension must answer the same way, or the web app and the extension would
    // disagree about what is worth saving.
    expect(extDecide([], capture)).toMatchObject({ action: 'skip', reason: 'shared-password' })
  })

  it('keeps the personal stage and shows the company in the name and as a field', () => {
    const capture = { url: 'https://talentradar-my.app/masuk', username: 'tifta', password: 'sandi-pribadi', tenant: 'PT Contoh' }
    expect(decideLoginSave([], capture)).toEqual({ action: 'create' })
    const { entries } = applyLoginCapture([], capture, 10, () => 'id-1')
    const saved = entries[0]
    expect(saved.name).toBe('Talentradar-my · PT Contoh')
    expect(saved.username).toBe('tifta')
    expect(saved.appName).toBe('PT Contoh')
    expect(saved.customFields).toEqual([
      { id: 'id-1', label: 'Perusahaan', value: 'PT Contoh', hidden: false },
    ])
    expect(tenantOf(saved)).toBe('PT Contoh')

    const ext = extApply([], capture, 10)
    expect(ext.changed).toBe('create')
    expect(ext.entries[0].name).toBe('Talentradar-my · PT Contoh')
    expect(ext.entries[0].customFields.map((f: { label: string; value: string }) => [f.label, f.value])).toEqual([
      ['Perusahaan', 'PT Contoh'],
    ])
  })

  it('updates the same company instead of adding a second row for it', () => {
    const first = { url: 'https://talentradar-my.app/masuk', username: 'tifta', password: 'lama', tenant: 'PT Contoh' }
    const { entries } = applyLoginCapture([], { ...first, password: '' }, 10, () => 'id-1')
    // An empty password is not a save; start from a real one.
    expect(entries).toEqual([])
    const one = applyLoginCapture([], first, 10, () => 'id-1').entries
    const again = applyLoginCapture(one, { ...first, password: 'baru' }, 20)
    expect(again.changed).toBe('update')
    expect(again.entries).toHaveLength(1)
    expect(again.entries[0].password).toBe('baru')
    expect(again.entries[0].customFields).toHaveLength(1)
    expect(again.entries[0].name).toBe('Talentradar-my · PT Contoh')
  })

  it('does not call two companies the same site duplicate', () => {
    const entries = [
      { id: 'a', type: 'login', name: 'Talentradar-my · PT Contoh', url: 'https://talentradar-my.app/masuk', urls: ['https://talentradar-my.app/masuk'], username: 'tifta', password: 'p1', appName: 'PT Contoh', customFields: [], tags: [], history: [], createdAt: 1, updatedAt: 2, favorite: false },
      { id: 'b', type: 'login', name: 'Talentradar-my · PT Lain', url: 'https://talentradar-my.app/masuk', urls: ['https://talentradar-my.app/masuk'], username: 'tifta', password: 'p2', appName: 'PT Lain', customFields: [], tags: [], history: [], createdAt: 1, updatedAt: 3, favorite: false },
    ] as never
    expect(findDuplicateClusters(entries)).toEqual([])
  })

  it('names the company on one company with two people, without calling them duplicates', () => {
    const entries = [
      { id: 'a', type: 'login', name: 'Talentradar-my · PT Contoh', url: 'https://talentradar-my.app/masuk', urls: ['https://talentradar-my.app/masuk'], username: 'tifta', password: 'p1', customFields: [{ id: 'f', label: 'Perusahaan', value: 'PT Contoh', hidden: false }], tags: [], history: [], createdAt: 1, updatedAt: 2, favorite: false },
      { id: 'b', type: 'login', name: 'Talentradar-my · PT Contoh', url: 'https://talentradar-my.app/masuk', urls: ['https://talentradar-my.app/masuk'], username: 'budi', password: 'p2', customFields: [{ id: 'f', label: 'Perusahaan', value: 'PT Contoh', hidden: false }], tags: [], history: [], createdAt: 1, updatedAt: 3, favorite: false },
    ] as never
    // Different usernames are different accounts, so neither is redundant.
    expect(findDuplicateClusters(entries)).toEqual([])
  })
})
