const ID_TIME = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const ID_DATE = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' })

export function formatDateTime(ms: number): string {
  return ID_TIME.format(ms)
}

export function formatDate(ms: number): string {
  return ID_DATE.format(ms)
}

export function relativeTime(ms: number, now = Date.now()): string {
  const diff = now - ms
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return 'baru saja'
  if (diff < hour) return `${Math.floor(diff / minute)} mnt lalu`
  if (diff < day) return `${Math.floor(diff / hour)} jam lalu`
  if (diff < 30 * day) return `${Math.floor(diff / day)} hari lalu`
  return formatDate(ms)
}
