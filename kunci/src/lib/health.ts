import type { Entry } from '../types'
import { passwordStrength } from './strength'

export interface HealthIssue {
  id: string
  entryId: string
  entryName: string
  kind: 'weak' | 'reused' | 'old' | 'pwned' | 'short'
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
  const secrets = entries.filter((e) => e.password)
  const byPassword = new Map<string, Entry[]>()
  for (const e of secrets) {
    const list = byPassword.get(e.password!) ?? []
    list.push(e)
    byPassword.set(e.password!, list)
  }

  const issues: HealthIssue[] = []
  for (const e of secrets) {
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
