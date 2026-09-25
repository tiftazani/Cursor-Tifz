import type { Entry } from '../types'
import { passwordStrength } from './strength'
import { findDuplicateClusters } from './duplicates'
import { hostFromUrl } from './match'

export interface HealthIssue {
  id: string
  entryId: string
  entryName: string
  kind: 'weak' | 'reused' | 'old' | 'pwned' | 'short' | 'insecure' | 'duplicate'
  detail: string
}

export interface HealthReport {
  score: number
  issues: HealthIssue[]
  weak: number
  reused: number
  old: number
  short: number
}

const YEAR = 1000 * 60 * 60 * 24 * 365

export function analyzeHealth(entries: Entry[], now = Date.now()): HealthReport {
  const secrets = entries.filter((e) => (e.type === 'login' || e.type === 'app') && e.password)
  const byPassword = new Map<string, Entry[]>()
  for (const e of secrets) {
    const list = byPassword.get(e.password!) ?? []
    list.push(e)
    byPassword.set(e.password!, list)
  }

  const issues: HealthIssue[] = []
  const eligible = entries.filter((e) => e.type === 'login' || e.type === 'app')
  const duplicateIds = new Set(findDuplicateClusters(eligible).flatMap((cluster) => cluster.memberIds))
  for (const e of eligible) {
    if (duplicateIds.has(e.id)) issues.push({
      id: `${e.id}-duplicate`, entryId: e.id, entryName: e.name,
      kind: 'duplicate', detail: 'Kemungkinan entri ganda; periksa sebelum menggabungkan',
    })
    const primary = e.url || e.urls[0] || ''
    if (e.password && /^http:\/\//i.test(primary.trim()) && hostFromUrl(primary)) issues.push({
      id: `${e.id}-insecure`, entryId: e.id, entryName: e.name,
      kind: 'insecure', detail: 'Alamat utama memakai HTTP tanpa enkripsi transport',
    })
  }
  for (const e of secrets.filter((e) => e.type === 'login' || e.type === 'app')) {
    const strength = passwordStrength(e.password!)
    if (e.password!.length < 10) {
      issues.push({
        id: `${e.id}-short`,
        entryId: e.id,
        entryName: e.name,
        kind: 'short',
        detail: `Hanya ${e.password!.length} karakter`,
      })
    }
    if (strength.score <= 1) {
      issues.push({
        id: `${e.id}-weak`,
        entryId: e.id,
        entryName: e.name,
        kind: 'weak',
        detail: strength.label,
      })
    }
    const twins = byPassword.get(e.password!) ?? []
    if (twins.length > 1) {
      issues.push({
        id: `${e.id}-reused`,
        entryId: e.id,
        entryName: e.name,
        kind: 'reused',
        detail: `Dipakai di ${twins.length} entri`,
      })
    }
    const changed = e.passwordChangedAt ?? e.updatedAt
    if (now - changed > YEAR) {
      issues.push({
        id: `${e.id}-old`,
        entryId: e.id,
        entryName: e.name,
        kind: 'old',
        detail: 'Lebih dari 1 tahun tanpa diganti',
      })
    }
  }

  const weak = issues.filter((i) => i.kind === 'weak').length
  const reused = issues.filter((i) => i.kind === 'reused').length
  const old = issues.filter((i) => i.kind === 'old').length
  const short = issues.filter((i) => i.kind === 'short').length
  const penalty = weak * 8 + reused * 6 + old * 3 + short * 4
  const score = secrets.length === 0 ? 100 : Math.max(0, 100 - penalty)

  return { score, issues, weak, reused, old, short }
}

export type IssueKind = HealthIssue['kind']
export type IssueTone = 'hi' | 'md' | 'lo' | 'info'

// Most urgent first. A breach beats reuse, reuse beats a weak password (one leak
// opens every site sharing it), and age is only advice.
const ORDER: IssueKind[] = ['pwned', 'reused', 'weak', 'short', 'insecure', 'duplicate', 'old']
const TONE: Record<IssueKind, IssueTone> = { pwned: 'hi', reused: 'md', weak: 'lo', short: 'lo', insecure: 'md', duplicate: 'info', old: 'info' }

export function sortHealthIssues(issues: HealthIssue[], entries: Entry[]): HealthIssue[] {
  const updated = new Map(entries.map((entry) => [entry.id, entry.updatedAt]))
  return [...issues].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind)
    || (updated.get(b.entryId) ?? 0) - (updated.get(a.entryId) ?? 0)
    || a.entryId.localeCompare(b.entryId))
}

export interface IssueSummary {
  /** Issue count. One entry can carry several, so this can exceed `entries`. */
  total: number
  /** Distinct entries with at least one issue. */
  entries: number
  byKind: { kind: IssueKind; count: number; tone: IssueTone }[]
  /** The single issue to act on first, or null when there is none. */
  top: HealthIssue | null
  headline: string
  advice: string
}

export function summarizeIssues(issues: HealthIssue[]): IssueSummary {
  const byKind = ORDER.map((kind) => ({
    kind,
    count: issues.filter((i) => i.kind === kind).length,
    tone: TONE[kind],
  })).filter((k) => k.count > 0)
  const entries = new Set(issues.map((i) => i.entryId)).size
  const top = byKind.length ? (issues.find((i) => i.kind === byKind[0].kind) ?? null) : null
  const total = byKind.reduce((n, k) => n + k.count, 0)
  if (total !== issues.length) throw new Error('summarizeIssues: unknown issue kind')
  if (!top) return { total: 0, entries: 0, byKind, top, headline: '', advice: '' }
  const name = top.entryName || 'Tanpa nama'
  const HEAD: Record<IssueKind, string> = {
    pwned: `Sandi ${name} muncul di kebocoran publik`,
    reused: `Sandi ${name} dipakai juga di entri lain`,
    weak: `Sandi ${name} lemah`,
    short: `Sandi ${name} terlalu pendek`,
    old: `Sandi ${name} sudah lama tidak diganti`,
    insecure: `Situs ${name} memakai HTTP`,
    duplicate: `Entri ${name} kemungkinan ganda`,
  }
  const ADVICE: Record<IssueKind, string> = {
    pwned: 'Ganti di situsnya dulu, lalu simpan sandi baru di Kunci.',
    reused: 'Kalau satu situs bocor, situs lain ikut terbuka. Buat sandi unik untuk tiap entri.',
    weak: 'Generator bisa membuat sandi pengganti yang kuat.',
    short: 'Sandi di bawah 10 karakter mudah ditebak. Generator bisa membuat penggantinya.',
    old: 'Sudah lebih dari 1 tahun. Ganti kalau situsnya penting.',
    insecure: 'Periksa alamat situs dan gunakan HTTPS bila tersedia.',
    duplicate: 'Periksa entri sebelum menggabungkan atau menghapusnya.',
  }
  return { total, entries, byKind, top, headline: HEAD[top.kind], advice: ADVICE[top.kind] }
}
