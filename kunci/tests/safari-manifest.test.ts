import { describe, expect, it } from 'vitest'
import { toSafariManifest } from '../helper/safari-manifest.mjs'

describe('Safari extension manifest', () => {
  it('uses an event-page background instead of a service worker', () => {
    const safari = toSafariManifest({
      manifest_version: 3,
      name: 'Kunci Autofill',
      background: { service_worker: 'background.js', type: 'module' },
    })
    expect(safari.background.service_worker).toBeUndefined()
    expect(safari.background.scripts).toEqual(['background.js'])
    expect(safari.background.type).toBe('module')
    expect(safari.background.persistent).toBe(false)
    expect(safari.browser_specific_settings.safari.strict_min_version).toBe('16.4')
  })
})
