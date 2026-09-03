export function isMacDesktop(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const platform = navigator.platform || ''
  if (/iPhone|iPad|iPod/i.test(ua)) return false
  return /Mac|Macintosh/i.test(ua) || /Mac/i.test(platform)
}

export function applyPlatformAttr(): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.platform = isMacDesktop() ? 'mac' : 'other'
}
