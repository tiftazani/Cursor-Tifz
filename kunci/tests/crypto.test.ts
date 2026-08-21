import { describe, expect, it } from 'vitest'
import { encryptVault, unlockBlob, persistWithKey, isEncryptedBlob, rewrapWithPassword } from '../src/lib/crypto'

describe('vault crypto', () => {
  it('round-trips JSON with the master password', async () => {
    const vault = { hello: 'dunia', n: 7 }
    const { blob, key } = await encryptVault(vault, 'KunciMaster-2026!', 12_000)
    expect(isEncryptedBlob(blob)).toBe(true)
    expect(blob.v).toBe(2)
    expect(blob.wrap).toBeTruthy()
    const unlocked = await unlockBlob<typeof vault>(blob, 'KunciMaster-2026!')
    expect(unlocked.data).toEqual(vault)
    const next = await persistWithKey({ hello: 'lagi' }, key, blob)
    const again = await unlockBlob<{ hello: string }>(next, 'KunciMaster-2026!')
    expect(again.data.hello).toBe('lagi')
  })

  it('rejects the wrong master password', async () => {
    const { blob } = await encryptVault({ a: 1 }, 'benar-sekali-12', 8_000)
    await expect(unlockBlob(blob, 'salah-sekali-12')).rejects.toBeTruthy()
  })

  it('rewraps the DEK with a new password without changing vault data', async () => {
    const { blob, key, dekBytes } = await encryptVault({ secret: 'ok' }, 'lama-password-12', 8_000)
    const next = await rewrapWithPassword(blob, key, 'baru-password-12')
    const unlocked = await unlockBlob<{ secret: string }>(next, 'baru-password-12')
    expect(unlocked.data.secret).toBe('ok')
    expect(unlocked.dekBytes).toEqual(dekBytes)
    await expect(unlockBlob(next, 'lama-password-12')).rejects.toBeTruthy()
  })
})
