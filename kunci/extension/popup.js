import { decryptVault, dekToB64, isEncryptedBlob, unlockErrorMessage } from './crypto.js'

const status = document.getElementById('status')
const unlock = document.getElementById('unlock')
const unlockBtn = document.getElementById('unlock-btn')
const app = document.getElementById('app')
const password = document.getElementById('password')
const search = document.getElementById('search')
const list = document.getElementById('list')
const error = document.getElementById('error')
const ver = document.getElementById('ver')
if (ver) ver.textContent = `v${chrome.runtime.getManifest().version}`

async function send(msg) {
  try {
    return await chrome.runtime.sendMessage(msg)
  } catch {
    return null
  }
}

function setBusy(on) {
  unlockBtn.disabled = on
  password.disabled = on
  unlockBtn.textContent = on ? 'Membuka…' : 'Buka'
}

function nextPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
}

async function refresh() {
  const s = await send({ type: 'STATUS' })
  if (!s) {
    unlock.hidden = false
    app.hidden = true
    status.textContent = 'Ekstensi sedang dimuat ulang. Tutup popup ini, lalu buka lagi.'
    return
  }
  if (s.unlocked) {
    unlock.hidden = true
    app.hidden = false
    status.textContent = `${s.count} entri · isi & simpan login website`
    await render('')
  } else {
    unlock.hidden = false
    app.hidden = true
    status.textContent = s.hasBlob
      ? 'Brankas terkunci. Buka bisa 5–10 detik — jangan tutup popup.'
      : 'Buka aplikasi web Kunci dulu, lalu kembali ke sini.'
  }
}

async function render(query) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const matches = tab?.url ? (await send({ type: 'MATCHES', url: tab.url })) || { matches: [] } : { matches: [] }
  const searched = (await send({ type: 'SEARCH', query })) || { entries: [] }
  const entries = query ? searched.entries : matches.matches?.length ? matches.matches : searched.entries
  list.innerHTML = ''
  for (const e of entries || []) {
    const li = document.createElement('li')
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.innerHTML = `<strong>${escapeHtml(e.name)}</strong><span>${escapeHtml(e.username || e.url || '')}</span>`
    btn.addEventListener('click', async () => {
      if (tab?.id) await chrome.tabs.sendMessage(tab.id, { type: 'FILL_ENTRY', entry: e }).catch(() => undefined)
      window.close()
    })
    li.appendChild(btn)
    list.appendChild(li)
  }
  if (!list.children.length) {
    list.innerHTML = '<li class="muted">Tidak ada hasil</li>'
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
}

unlock.addEventListener('submit', async (e) => {
  e.preventDefault()
  error.textContent = ''
  const pw = password.value
  if (!pw) {
    error.textContent = 'Masukkan kata sandi induk'
    return
  }
  setBusy(true)
  status.textContent = 'Membuka brankas… jangan tutup jendela ini.'
  await nextPaint()
  try {
    const blobRes = await send({ type: 'GET_BLOB' })
    const blob = blobRes?.blob
    if (!isEncryptedBlob(blob)) {
      error.textContent = 'Belum ada brankas. Buka tab Kunci, buka brankas di sana, lalu coba lagi.'
      status.textContent = 'Buka aplikasi web Kunci dulu, lalu kembali ke sini.'
      return
    }
    let vault
    let dekRaw
    try {
      ;({ vault, dekRaw } = await decryptVault(blob, pw))
    } catch (err) {
      error.textContent = unlockErrorMessage(err)
      status.textContent = 'Brankas terkunci. Buka bisa 5–10 detik — jangan tutup popup.'
      return
    }
    const res = await send({ type: 'UNLOCKED', vault, dekB64: dekToB64(dekRaw) })
    if (!res?.ok) {
      error.textContent = res?.error || 'Gagal menyimpan sesi. Tutup popup, lalu coba lagi.'
      return
    }
    password.value = ''
    await refresh()
  } finally {
    setBusy(false)
  }
})

search.addEventListener('input', () => {
  void render(search.value)
})

void refresh()
