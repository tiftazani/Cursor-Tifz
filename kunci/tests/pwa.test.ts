import { describe, expect, it } from 'vitest'
import { isIosDevice, shouldOfferIosInstall } from '../src/lib/pwa'

describe('iOS home-screen install', () => {
  it('detects iPhone Safari', () => {
    expect(
      isIosDevice(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
        'iPhone',
        5,
      ),
    ).toBe(true)
  })

  it('does not treat desktop Chrome as iOS', () => {
    expect(
      isIosDevice(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'MacIntel',
        0,
      ),
    ).toBe(false)
  })

  it('offers install until it is on the home screen or dismissed', () => {
    expect(shouldOfferIosInstall({ standalone: false, dismissed: false })).toBe(true)
    expect(shouldOfferIosInstall({ standalone: true, dismissed: false })).toBe(false)
    expect(shouldOfferIosInstall({ standalone: false, dismissed: true })).toBe(false)
  })
})
