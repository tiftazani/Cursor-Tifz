export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}

/**
 * Clear the clipboard after `seconds`, and report whether it really cleared.
 *
 * `readText` is blocked on an unfocused document and in Safari/Firefox, and
 * `writeText('')` can be refused too. Announcing "Papan klip dibersihkan" when
 * either call failed tells the user a password is gone when it is still there.
 */
export function scheduleClipboardClear(
  seconds: number,
  expected: string,
  onDone?: (cleared: boolean) => void,
): () => void {
  if (seconds <= 0 || typeof window === 'undefined') return () => {}
  const timer = window.setTimeout(() => {
    void (async () => {
      let cleared = false
      try {
        const current = await navigator.clipboard.readText()
        // Only wipe it if it still holds what we put there: the user may have
        // copied something else in the meantime, and that is not ours to delete.
        if (current === expected) {
          await navigator.clipboard.writeText('')
          cleared = true
        }
      } catch {
        /* Safari/Firefox may block read */
      }
      onDone?.(cleared)
    })()
  }, seconds * 1000)
  return () => window.clearTimeout(timer)
}

export async function sequentialCopy(
  username: string | undefined,
  password: string | undefined,
  gapSeconds: number,
  onPhase: (phase: 'user' | 'pass' | 'done') => void,
): Promise<void> {
  if (username) {
    await copyText(username)
    onPhase('user')
    if (password) {
      await new Promise((r) => setTimeout(r, Math.max(1, gapSeconds) * 1000))
      await copyText(password)
      onPhase('pass')
      return
    }
  } else if (password) {
    await copyText(password)
    onPhase('pass')
  }
  onPhase('done')
}
