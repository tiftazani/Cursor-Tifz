import { describe, expect, it } from 'vitest'
import { encryptVault, unlockBlob } from '../src/lib/crypto'
import { decryptVault, isEncryptedBlob, unlockErrorMessage } from '../extension/crypto.js'

describe('extension crypto matches the web vault', () => {
  it('decrypts a v2 blob created by the web app', async () => {
    const vault = { entries: [{ id: '1', name: 'Gmail', username: 'a@b.c', password: 'rahasia' }], settings: {} }
    const { blob, dekBytes } = await encryptVault(vault, 'KunciMaster-2026!', 8_000)
    expect(isEncryptedBlob(blob)).toBe(true)
    const opened = await decryptVault(blob, 'KunciMaster-2026!')
    expect(opened.vault).toEqual(vault)
    expect(opened.dekRaw).toEqual(dekBytes)
    const web = await unlockBlob<typeof vault>(blob, 'KunciMaster-2026!')
    expect(web.data).toEqual(opened.vault)
  })

  it('maps empty WebCrypto failures to a master-password error', () => {
    const err = new Error('')
    err.name = 'OperationError'
    expect(unlockErrorMessage(err)).toBe('Kata sandi induk salah')
    expect(unlockErrorMessage(new Error('Format brankas tidak dikenali'))).toBe('Format brankas tidak dikenali')
  })
})
