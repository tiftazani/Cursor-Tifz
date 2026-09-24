/**
 * Put a Resend API key on the Kunci Worker without the key touching the shell
 * history or the chat: copy it in the Resend dashboard, then run this.
 *
 * The clipboard is wiped afterwards so the key does not sit there for the next
 * paste into some other field.
 */
import { spawnSync } from 'node:child_process'

const KEY_RE = /^re_[A-Za-z0-9_-]{8,}$/

function clipboard() {
  const r = spawnSync('pbpaste', { encoding: 'utf8' })
  return r.status === 0 ? (r.stdout || '').trim() : ''
}

function clearClipboard() {
  spawnSync('pbcopy', { input: '' })
}

const key = clipboard()
if (!key) {
  console.error('Papan klip kosong.')
  console.error('Di https://resend.com/api-keys klik Create API Key, izin Sending access, copy.')
  console.error('Lalu jalankan perintah ini lagi.')
  process.exit(1)
}
if (!KEY_RE.test(key)) {
  console.error(`Papan klip bukan API key Resend (panjang ${key.length}, awalan ${JSON.stringify(key.slice(0, 4))}).`)
  console.error('Key Resend mulai dengan "re_". Copy ulang dari resend.com/api-keys.')
  process.exit(1)
}

const put = spawnSync('npx', ['wrangler', 'secret', 'put', 'RESEND_API_KEY'], {
  input: key,
  stdio: ['pipe', 'inherit', 'inherit'],
})
clearClipboard()

if (put.status !== 0) {
  console.error('\nGagal menyimpan secret. Cek pesan di atas.')
  process.exit(put.status ?? 1)
}
console.log('\nPapan klip sudah dikosongkan. Cek: npx wrangler secret list')
