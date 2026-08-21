import type { Entry } from '../types'

export function searchEntries(entries: Entry[], query: string): Entry[] {
  const q = query.trim().toLowerCase()
  if (!q) return entries
  const parts = q.split(/\s+/).filter(Boolean)
  return entries.filter((e) => {
    const hay = [
      e.name,
      e.username,
      e.url,
      e.appName,
      e.notes,
      e.tags.join(' '),
      ...e.urls,
      ...e.customFields.map((f) => `${f.label} ${f.hidden ? '' : f.value}`),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return parts.every((p) => hay.includes(p))
  })
}
