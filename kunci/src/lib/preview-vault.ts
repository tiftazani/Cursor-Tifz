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
  return {
    ...EMPTY_VAULT,
    entries: [
      login('agoda-a', 'agoda.com', 'https://agoda.com', 'tif@example.com', 'SamePass!234', now),
      login('agoda-b', 'www.agoda.com', 'https://www.agoda.com', 'tif@example.com', 'SamePass!234', now - 3_600_000),
      login('mail', 'Gmail', 'https://gmail.com', 'other@example.com', 'Tr0pical-Mail-2026!!', now - 8_000_000),
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
