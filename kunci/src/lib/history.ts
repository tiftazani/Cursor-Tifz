import type { Entry, HistoryRecord } from '../types'
import { newId } from './id'

export function withCredentialHistory(previous: Entry, next: Entry): Entry {
  const userChanged = (previous.username ?? '') !== (next.username ?? '')
  const passChanged = (previous.password ?? '') !== (next.password ?? '')
  const now = Date.now()
  if (!userChanged && !passChanged) {
    return { ...next, updatedAt: now, history: previous.history }
  }
  const record: HistoryRecord = {
    id: newId(),
    username: previous.username,
    password: previous.password,
    changedAt: now,
  }
  return {
    ...next,
    history: [record, ...previous.history].slice(0, 50),
    updatedAt: now,
    passwordChangedAt: passChanged ? now : (next.passwordChangedAt ?? previous.passwordChangedAt),
  }
}

export function restoreHistoryRecord(entry: Entry, record: HistoryRecord): Entry {
  return withCredentialHistory(entry, {
    ...entry,
    username: record.username,
    password: record.password,
  })
}

export interface FlatHistory {
  entryId: string
  entryName: string
  record: HistoryRecord
}

export function flattenHistory(entries: Entry[]): FlatHistory[] {
  const rows: FlatHistory[] = []
  for (const entry of entries) {
    for (const record of entry.history) {
      rows.push({ entryId: entry.id, entryName: entry.name, record })
    }
  }
  return rows.sort((a, b) => b.record.changedAt - a.record.changedAt)
}
