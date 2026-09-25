import { useState } from 'react'
import type { Entry } from '../types'
import { faviconUrl, letterAvatar } from '../lib/favicon'
import { IconApp, IconGlobe, IconNote, IconOtp } from './Icons'

/** Favicon when the entry has a site, otherwise (or when it fails to load) a
 *  letter or type icon, so the row never renders an empty gap. */
export function EntryGlyph({ entry }: { entry: Entry }) {
  const src = faviconUrl(entry.url)
  const [failed, setFailed] = useState<string | null>(null)
  // "www.agoda.com" and "agoda.com" are the same site; give them one avatar.
  const { letter, hue } = letterAvatar((entry.name || entry.appName || '?').replace(/^www\./i, ''))
  if (src && failed !== src) {
    return <img className="glyph" src={src} alt="" onError={() => setFailed(src)} />
  }
  const Icon = entry.type === 'app' ? IconApp : entry.type === 'note' ? IconNote : entry.type === 'totp' ? IconOtp : IconGlobe
  return (
    <span className="glyph letter" style={{ background: `hsl(${hue} 40% 22%)`, color: `hsl(${hue} 70% 72%)` }}>
      {entry.type === 'login' ? letter : <Icon size={14} />}
    </span>
  )
}
