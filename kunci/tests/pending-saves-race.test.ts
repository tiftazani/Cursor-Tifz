import { describe, expect, it } from 'vitest'

/**
 * background.js keeps one map of logins waiting to be saved, keyed by tab. Two tabs
 * finishing a login at the same moment used to read the map, both write it back, and
 * the second write silently dropped the first tab's capture.
 *
 * This mirrors `withPendingSaves` in extension/background.js exactly. The real
 * function cannot be imported: background.js registers chrome.runtime.onMessage
 * listeners at module scope, so importing it needs a chrome stub and the assertion
 * would be about the stub, not the code. Keep the two in step by hand.
 */
function makePendingStore(session: { get: (k: string) => Promise<Record<string, unknown>>; set: (o: unknown) => Promise<void> }) {
  let pendingChain: Promise<unknown> = Promise.resolve()
  return function withPendingSaves(mutate: (map: Record<string, { capture?: unknown }>) => void) {
    const run = pendingChain.then(async () => {
      const pendingSaves = ((await session.get('pendingSaves')).pendingSaves as Record<string, { capture?: unknown }>) || {}
      mutate(pendingSaves)
      await session.set({ pendingSaves })
    })
    pendingChain = run.catch(() => undefined)
    return run
  }
}

function slowSession() {
  let data: Record<string, unknown> = {}
  return {
    get: async (key: string) => {
      // A real storage read is asynchronous; that gap is where the old code lost data.
      await new Promise((r) => setTimeout(r, 1))
      return { [key]: data[key] }
    },
    set: async (obj: Record<string, unknown>) => {
      await new Promise((r) => setTimeout(r, 1))
      Object.assign(data, obj)
    },
    dump: () => data,
  }
}

describe('pendingSaves survives two saves at once', () => {
  it('keeps both tabs when they store at the same moment', async () => {
    const session = slowSession()
    const withPendingSaves = makePendingStore(session)
    await Promise.all([
      withPendingSaves((map) => {
        map['1'] = { capture: { username: 'a', password: 'p1' } }
      }),
      withPendingSaves((map) => {
        map['2'] = { capture: { username: 'b', password: 'p2' } }
      }),
    ])
    const saved = session.dump().pendingSaves as Record<string, unknown>
    expect(Object.keys(saved).sort()).toEqual(['1', '2'])
  })

  it('would lose one without the chain', async () => {
    // The old shape, kept here so the test proves the bug was real rather than
    // asserting a property of the new code alone.
    const session = slowSession()
    const oldStore = async (tabId: string, pending: unknown) => {
      const map = ((await session.get('pendingSaves')).pendingSaves as Record<string, unknown>) || {}
      map[tabId] = pending
      await session.set({ pendingSaves: map })
    }
    await Promise.all([oldStore('1', { capture: 'a' }), oldStore('2', { capture: 'b' })])
    expect(Object.keys(session.dump().pendingSaves as Record<string, unknown>)).toHaveLength(1)
  })

  it('does not stop working after one failure', async () => {
    const session = slowSession()
    const withPendingSaves = makePendingStore(session)
    await expect(
      withPendingSaves(() => {
        throw new Error('quota')
      }),
    ).rejects.toThrow('quota')
    await withPendingSaves((map) => {
      map['9'] = { capture: 'later' }
    })
    expect(Object.keys(session.dump().pendingSaves as Record<string, unknown>)).toEqual(['9'])
  })
})
