import { readFileSync } from 'node:fs'
import { entriesFromCsv } from '../src/lib/csv'
import { findDuplicateClusters } from '../src/lib/duplicates'
import { entryMatchesPage, hostFromUrl } from '../src/lib/match'

const text = readFileSync('/Users/tiftazani/Documents/Brave Passwords.csv', 'utf8')
const entries = entriesFromCsv(text, 1)
console.log('total entries:', entries.length)

// 1. Names that are a URL, not a name.
const urlNames = entries.filter((e) => /^[a-z]+:\/\//i.test(e.name))
console.log('\n[1] name is a raw URL:', urlNames.length)
for (const e of urlNames.slice(0, 6)) console.log('   ', e.name.slice(0, 60))

// 2. Names holding a credential (base64 with == or an @account).
const credNames = entries.filter((e) => /==|@/.test(e.name) && !/^https?:/.test(e.name))
console.log('\n[2] name holds a credential:', credNames.length)
for (const e of credNames.slice(0, 6)) console.log('   ', e.name.slice(0, 60))

// 3. No username at all.
const noUser = entries.filter((e) => !e.username)
console.log('\n[3] entries with no username:', noUser.length)
for (const e of noUser.slice(0, 6)) console.log('   ', JSON.stringify({ name: e.name.slice(0, 45), url: (e.url || '').slice(0, 45) }))

// 4. No URL at all.
const noUrl = entries.filter((e) => !e.url)
console.log('\n[4] entries with no url:', noUrl.length)
for (const e of noUrl.slice(0, 6)) console.log('   ', JSON.stringify({ name: e.name.slice(0, 45), user: e.username }))

// 5. Duplicate-looking: same host + same username, different password.
const byKey = new Map<string, typeof entries>()
for (const e of entries) {
  const h = hostFromUrl(e.url || '')
  if (!h) continue
  const k = `${h}|${(e.username || '').trim().toLowerCase()}`
  byKey.set(k, [...(byKey.get(k) ?? []), e])
}
let sameKey = 0
for (const [k, list] of byKey) {
  if (list.length < 2) continue
  sameKey++
  if (sameKey <= 8) {
    console.log('\n[5] same host+username:', k, '->', list.length, 'entries')
    for (const e of list) console.log('     pw-len', (e.password || '').length, 'name', e.name.slice(0, 40))
  }
}
console.log('\n[5] groups with same host+username:', sameKey)

// 6. Type detection: rows that ended up as app/password/note.
const byType: Record<string, number> = {}
for (const e of entries) byType[e.type] = (byType[e.type] || 0) + 1
console.log('\n[6] types:', JSON.stringify(byType))

// 7. Does an android entry match the real website's page?
const androidRow = entries.find((e) => (e.url || '').startsWith('android://'))
const realQuora = entries.find((e) => hostFromUrl(e.url || '') === 'quora.com')
if (androidRow) {
  console.log('\n[7] android entry host:', hostFromUrl(androidRow.url || ''))
  console.log('    matches https://www.quora.com ?', entryMatchesPage(androidRow, 'https://www.quora.com/'))
  console.log('    matches its own android url ?', entryMatchesPage(androidRow, androidRow.url || ''))
}
console.log('    real quora entry present:', Boolean(realQuora))

// 8. How many android entries lose their host entirely (no layer)?
const android = entries.filter((e) => (e.url || '').startsWith('android://'))
console.log('\n[8] android:// entries:', android.length)
console.log('    of those, name differs from the package:', android.filter((e) => !e.name.includes('com.')).length)

// 9. Clusters touching android entries.
const clusters = findDuplicateClusters(entries)
const withAndroid = clusters.filter((c) => c.members.some((m) => m.id && android.some((a) => a.id === m.id)))
console.log('\n[9] clusters containing an android entry:', withAndroid.length)
for (const c of withAndroid) console.log('   ', c.title.slice(0, 60), c.detail)

// 10. Empty names?
const empty = entries.filter((e) => !e.name.trim() || e.name === 'Tanpa nama')
console.log('\n[10] entries with an empty or placeholder name:', empty.length)
