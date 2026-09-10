export const IOS_INSTALL_DISMISS_KEY = 'kunci_ios_install_dismissed'

export function isIosDevice(
  ua = typeof navigator === 'undefined' ? '' : navigator.userAgent,
  platform = typeof navigator === 'undefined' ? '' : navigator.platform,
  maxTouchPoints = typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints,
): boolean {
  if (/iPhone|iPad|iPod/i.test(ua)) return true
  return platform === 'MacIntel' && maxTouchPoints > 1
}

export function isStandaloneDisplay(win: Pick<Window, 'navigator' | 'matchMedia'> | null = typeof window === 'undefined' ? null : window): boolean {
  if (!win) return false
  const nav = win.navigator as Navigator & { standalone?: boolean }
  if (nav.standalone) return true
  return win.matchMedia('(display-mode: standalone)').matches
}

export function shouldOfferIosInstall(opts: { standalone: boolean; dismissed: boolean }): boolean {
  return !opts.standalone && !opts.dismissed
}

export function readInstallDismissed(): boolean {
  try {
    return window.localStorage.getItem(IOS_INSTALL_DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissIosInstall(): void {
  try {
    window.localStorage.setItem(IOS_INSTALL_DISMISS_KEY, '1')
  } catch {
    /* private mode */
  }
}

export function markStandaloneClass(): void {
  if (isStandaloneDisplay()) document.documentElement.classList.add('kunci-standalone')
}

export function registerServiceWorker(): void {
  if (import.meta.env.DEV) return
  if (!('serviceWorker' in navigator)) return
  void navigator.serviceWorker.register('/sw.js')
}
