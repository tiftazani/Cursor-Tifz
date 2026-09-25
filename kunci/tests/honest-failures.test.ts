import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { unlockErrorMessage } from '../src/lib/crypto'
import { scheduleClipboardClear } from '../src/lib/clipboard'

const workerSource = readFileSync(join(import.meta.dirname, '..', 'worker', 'index.ts'), 'utf8')

describe('a wrong code is counted once', () => {
  /**
   * The success path used to write the OTP record twice: once unconditionally to
   * bump `attempts`, then again to expire it. Nothing broke visibly, but the first
   * write was pure waste on the one path that matters, and it made the wrong-code
   * counter harder to reason about.
   */
  it('spends one attempt atomically and expires the record once', () => {
    const wrongBranch = workerSource.slice(
      workerSource.indexOf('const ok = safeEqual(incoming, otp.hash)'),
      workerSource.indexOf('const session = await issueSession'),
    )
    expect(wrongBranch).toContain("return respond({ error: 'Kode salah' }, 401)")
    // The wrong-code path no longer writes the record from the worker: it spends one
    // attempt through the Durable Object, which is the only place the counter can be
    // read-checked-incremented without a race. The worker's own setKey('otp') call is
    // therefore only the expiry on the success path.
    expect(wrongBranch).toContain("op: 'take-attempt'")
    const writes = wrongBranch.match(/setKey\('otp'/g) ?? []
    expect(writes).toHaveLength(1)
    // The unconditional bump before the branch must still be gone.
    expect(wrongBranch.indexOf("setKey('otp'")).toBeGreaterThan(wrongBranch.indexOf('if (!ok)'))
  })
})

describe('a wrong master password says so', () => {
  it('maps the empty WebCrypto failure to plain words', () => {
    const err = new Error('The operation failed for an operation-specific reason')
    err.name = 'OperationError'
    expect(unlockErrorMessage(err)).toBe('Kata sandi induk salah')
  })

  it('passes a real message through untouched', () => {
    expect(unlockErrorMessage(new Error('Format brankas tidak dikenali'))).toBe('Format brankas tidak dikenali')
  })

  it('handles a thrown non-Error', () => {
    expect(unlockErrorMessage('boom')).toBe('boom')
    expect(unlockErrorMessage(null)).toBe('Kata sandi induk salah')
  })
})

describe('the clipboard clear reports the truth', () => {
  it('says it did not clear when the clipboard still holds the secret', async () => {
    const original = globalThis.navigator
    const writes: string[] = []
    // readText is blocked on an unfocused document: the wipe never happens, and the
    // user must not be told it did.
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        clipboard: {
          readText: async () => {
            throw new Error('Document is not focused')
          },
          writeText: async (t: string) => {
            writes.push(t)
          },
        },
      },
    })
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout },
    })

    const result = await new Promise<boolean>((resolve) => {
      scheduleClipboardClear(0.01, 'rahasia', (cleared) => resolve(cleared))
    })
    expect(result).toBe(false)
    expect(writes).toEqual([])

    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: original })
  })

  it('reports success when the clipboard really was wiped', async () => {
    const original = globalThis.navigator
    let held = 'rahasia'
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        clipboard: {
          readText: async () => held,
          writeText: async (t: string) => {
            held = t
          },
        },
      },
    })
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout },
    })

    const result = await new Promise<boolean>((resolve) => {
      scheduleClipboardClear(0.01, 'rahasia', (cleared) => resolve(cleared))
    })
    expect(result).toBe(true)
    expect(held).toBe('')

    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: original })
  })
})
