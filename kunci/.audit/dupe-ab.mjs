// A/B: old duplicates.ts (git HEAD) vs new, on data shaped like the user's vault.
// Root cause being tested: old code linked entries by normalized NAME across hosts,
// so entries named after the same account email all chained into one 14-entry cluster.
import { findDuplicateClusters as oldFind } from './old-duplicates.ts'
import { findDuplicateClusters as newFind } from '../src/lib/duplicates.ts'

const row = (id, url, username, name) => ({
  id,
  type: 'login',
  name,
  url,
  urls: [],
  username,
  password: `p${id}`,
  tags: [],
  favorite: false,
  customFields: [],
  history: [],
  createdAt: 1,
  updatedAt: 1,
})

// Names carry the account email, which is how the user's entries look.
const M = 'tiftazani@gmail.com'
const entries = [
  row('1', 'https://accounts.google.com', M, M),
  row('2', 'https://accounts.google.com', M, M),
  row('3', 'https://accounts.spotify.com', M, M),
  row('4', 'https://my.account.sony.com', '', M),
  row('5', 'https://my.account.sony.com', M, M),
  row('6', 'https://myaccount.google.com', M, M),
  row('7', 'https://www.amazon.com', M, M),
  row('8', 'https://www.dekkoo.com', M, M),
  row('9', 'https://www.gagaoolala.com', M, M),
  row('10', 'https://www.amazon.com', 'lain@x.com', M),
  row('11', 'https://agoda.com', M, M),
  row('12', 'https://www.agoda.com', M, M),
  row('13', 'https://accounts.google.com', M, 'OTP Google'),
  row('14', 'https://accounts.google.com', M, 'Google OTP'),
]

function summarise(clusters) {
  return {
    count: clusters.length,
    largest: Math.max(0, ...clusters.map((c) => c.members.length)),
    crossHost: clusters.filter((c) => new Set(c.members.map((m) => m.host)).size > 1).length,
    groups: clusters.map((c) => `${c.title}: ${c.members.length} [${c.members.map((m) => m.id).join(',')}]`),
  }
}

const before = summarise(oldFind(entries))
const after = summarise(newFind(entries))
console.log('BEFORE (git HEAD):', JSON.stringify(before, null, 2))
console.log('AFTER  (fixed)   :', JSON.stringify(after, null, 2))

const pass =
  before.largest >= 10 &&
  before.crossHost >= 1 &&
  after.crossHost === 0 &&
  after.largest <= 3 &&
  !after.groups.some((g) => g.includes('13') || g.includes('14'))
console.log(pass ? 'PASS: cluster raksasa hilang, OTP keluar, tidak ada lintas host' : 'FAIL')
process.exit(pass ? 0 : 1)
