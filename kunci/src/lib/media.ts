import { useEffect, useState } from 'react'

export const COMPACT_MAX_PX = 1100
export const COMPACT_NAV_QUERY = `(max-width: ${COMPACT_MAX_PX}px)`
export const PHONE_QUERY = COMPACT_NAV_QUERY

function readCompact(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(COMPACT_NAV_QUERY).matches || window.innerWidth <= COMPACT_MAX_PX
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (typeof window === 'undefined' ? false : window.matchMedia(query).matches))

  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setMatches(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** Phone/tablet chrome: bottom tabs, one pane. Also checks innerWidth because iOS Safari matchMedia can lag. */
export function useCompactLayout(): boolean {
  const fromQuery = useMediaQuery(COMPACT_NAV_QUERY)
  const [fromWidth, setFromWidth] = useState(() => readCompact())

  useEffect(() => {
    const sync = () => setFromWidth(readCompact())
    sync()
    window.addEventListener('resize', sync)
    window.visualViewport?.addEventListener('resize', sync)
    return () => {
      window.removeEventListener('resize', sync)
      window.visualViewport?.removeEventListener('resize', sync)
    }
  }, [])

  return fromQuery || fromWidth
}
