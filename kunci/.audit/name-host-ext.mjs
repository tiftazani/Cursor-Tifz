// Does the EXTENSION copy also refuse to offer an account-named entry on hosts
// found inside the address? Web copy is covered by tests/match.test.ts.
import { matchesForUrl } from '../extension/crypto.js'

const rows = [
  { id: 'named', type: 'login', name: 'tiftazani@gmail.com', url: 'https://agoda.com', urls: ['https://agoda.com'] },
  { id: 'site', type: 'login', name: 'Agoda', url: '', urls: [] },
  { id: 'bank', type: 'login', name: 'My Bank Login', url: '', urls: [] },
]

const ids = (url) => matchesForUrl(rows, url).map((e) => e.id)
const cases = [
  ['https://agoda.com', ['named', 'site']],
  ['https://gmail.com', []],
  ['https://google.com', []],
  ['https://www.agoda.com', ['named', 'site']],
]

let bad = 0
for (const [url, want] of cases) {
  const got = ids(url)
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) bad++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${url} -> ${JSON.stringify(got)} want ${JSON.stringify(want)}`)
}
console.log(bad ? `FAILED ${bad}` : 'PASS: extension never reads an account name as a host')
process.exit(bad ? 1 : 0)
