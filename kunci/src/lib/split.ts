export const SIDEBAR_MIN = 168
export const SIDEBAR_MAX = 360
export const LIST_MIN = 240
export const LIST_MAX = 560
export const SIDEBAR_DEFAULT = 220
export const LIST_DEFAULT = 300

const KEY = 'kunci.split.v1'

export function clampSplit(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)))
}

export interface SplitWidths {
  sidebar: number
  list: number
}

export function defaultSplit(): SplitWidths {
  return { sidebar: SIDEBAR_DEFAULT, list: LIST_DEFAULT }
}

export function parseSplit(raw: unknown): SplitWidths {
  const d = defaultSplit()
  if (!raw || typeof raw !== 'object') return d
  const o = raw as { sidebar?: unknown; list?: unknown }
  return {
    sidebar: typeof o.sidebar === 'number' ? clampSplit(o.sidebar, SIDEBAR_MIN, SIDEBAR_MAX) : d.sidebar,
    list: typeof o.list === 'number' ? clampSplit(o.list, LIST_MIN, LIST_MAX) : d.list,
  }
}

export function loadSplit(): SplitWidths {
  if (typeof localStorage === 'undefined') return defaultSplit()
  try {
    return parseSplit(JSON.parse(localStorage.getItem(KEY) || 'null'))
  } catch {
    return defaultSplit()
  }
}

export function saveSplit(next: SplitWidths): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(parseSplit(next)))
}
