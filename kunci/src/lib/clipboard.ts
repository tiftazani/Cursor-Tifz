export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}

export function scheduleClipboardClear(
  seconds: number,
  expected: string,
  onCleared?: () => void,
): () => void {
  if (seconds <= 0 || typeof window === 'undefined') return () => {}
  const timer = window.setTimeout(() => {
    void (async () => {
      try {
        const current = await navigator.clipboard.readText()
        if (current === expected) await navigator.clipboard.writeText('')
      } catch {
        /* Safari/Firefox may block read */
      }
      onCleared?.()
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
