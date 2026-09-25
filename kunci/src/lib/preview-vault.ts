import { EMPTY_VAULT, type Entry, type Vault } from '../types'

function login(id: string, name: string, url: string, username: string, password: string, updatedAt: number): Entry {
  return {
    id,
    type: 'login',
    name,
    username,
    password,
    url,
    urls: [url],
    tags: [],
    favorite: false,
    customFields: [],
    history: [],
    createdAt: updatedAt - 86_400_000,
    updatedAt,
  }
}

export function previewVault(): Vault {
  const now = 1_800_000_000_000
  // A real yesterday, taken from the clock rather than from `now`. The fixture's `now` is
  // a fixed future date, so deriving "yesterday" from it put the seeded evidence ahead of
  // the machine's own clock and the day-gate could never advance past it.
  const yesterday = new Date(Date.now() - 86_400_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const yesterdayKey = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`
  return {
    ...EMPTY_VAULT,
    // Yesterday's evidence for the dead domain, so the preview shows a confirmed finding
    // without anyone having to wait a real day for it.
    linkHealth: {
      'gone-1': {
        entryId: 'gone-1',
        url: 'this-domain-definitely-does-not-exist-9z8y7x.com',
        deadDays: 1,
        lastDay: yesterdayKey,
        lastReason: 'dns',
        lastAt: now - 86_400_000,
      },
    },
    entries: [
      login('agoda-a', 'agoda.com', 'https://agoda.com', 'tif@example.com', 'SamePass!234', now),
      login('agoda-b', 'www.agoda.com', 'https://www.agoda.com', 'tif@example.com', 'SamePass!234', now - 3_600_000),
      login('mail', 'Gmail', 'https://gmail.com', 'other@example.com', 'Tr0pical-Mail-2026!!', now - 8_000_000),
      // A domain that does not resolve, so the dead-site card has something to find.
      // Kept in the fixtures only: the check must be provable without touching a real
      // vault, and a site that is definitely gone is the only honest way to test it.
      login('gone-1', 'Situs lama', 'this-domain-definitely-does-not-exist-9z8y7x.com', 'tif@example.com', 'OldPass!2345', now - 20_000_000),
      {
        id: 'note-1',
        type: 'note',
        name: 'PIN wifi',
        urls: [],
        notes: 'rumah',
        tags: [],
        favorite: true,
        customFields: [],
        history: [],
        createdAt: now,
        updatedAt: now,
      },
    ],
  }
}

export function isPreviewUi(): boolean {
  return import.meta.env.DEV && typeof window !== 'undefined' && window.location.hash === '#preview-ui'
}
