import { hostFromUrl } from './match'

export function faviconUrl(urlOrHost?: string): string | null {
  if (!urlOrHost) return null
  const host = hostFromUrl(urlOrHost)
  if (!host) return null
  return `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`
}

export function letterAvatar(name: string): { letter: string; hue: number } {
  const letter = (name.trim().charAt(0) || '?').toUpperCase()
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return { letter, hue: hash % 360 }
}
