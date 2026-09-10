export const AUTO_LOCK_NEVER = -1
export const AUTO_LOCK_IMMEDIATE = 0

export const AUTO_LOCK_OPTIONS = [
  { seconds: AUTO_LOCK_IMMEDIATE, label: 'Segera (saat pindah tab atau jendela tidak aktif)' },
  { seconds: 15, label: '15 detik tidak aktif' },
  { seconds: 30, label: '30 detik tidak aktif' },
  { seconds: 60, label: '1 menit tidak aktif' },
  { seconds: 300, label: '5 menit tidak aktif' },
  { seconds: AUTO_LOCK_NEVER, label: 'Selalu terbuka (jangan kunci otomatis)' },
] as const

const ALLOWED = new Set<number>(AUTO_LOCK_OPTIONS.map((o) => o.seconds))

export function resolveAutoLockSeconds(settings: {
  autoLockSeconds?: number
  autoLockMinutes?: number
}): number {
  if (typeof settings.autoLockSeconds === 'number' && Number.isFinite(settings.autoLockSeconds)) {
    return ALLOWED.has(settings.autoLockSeconds) ? settings.autoLockSeconds : snapLegacySeconds(settings.autoLockSeconds)
  }
  const minutes = settings.autoLockMinutes
  if (minutes === 0) return AUTO_LOCK_NEVER
  if (typeof minutes === 'number' && Number.isFinite(minutes) && minutes > 0) {
    return snapLegacySeconds(Math.round(minutes * 60))
  }
  return 300
}

function snapLegacySeconds(value: number): number {
  if (ALLOWED.has(value)) return value
  if (value < 0) return AUTO_LOCK_NEVER
  if (value <= 8) return AUTO_LOCK_IMMEDIATE
  if (value <= 22) return 15
  if (value <= 45) return 30
  if (value <= 180) return 60
  if (value <= 600) return 300
  return AUTO_LOCK_NEVER
}
