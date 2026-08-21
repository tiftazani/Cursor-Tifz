import { describe, expect, it } from 'vitest'
import { parseBackupFile } from '../src/lib/folder-backup'
import type { EncryptedBlob } from '../src/types'

const blob: EncryptedBlob = {
  v: 1,
  kdf: 'PBKDF2-SHA256',
  iter: 1,
  salt: 'YQ==',
  iv: 'YQ==',
  data: 'YQ==',
}

describe('backup file', () => {
  it('accepts wrapped and raw encrypted blobs', () => {
    expect(parseBackupFile({ app: 'kunci', blob })).toEqual(blob)
    expect(parseBackupFile(blob)).toEqual(blob)
  })

  it('rejects junk', () => {
    expect(() => parseBackupFile({ hello: true })).toThrow(/bukan cadangan/i)
  })
})
