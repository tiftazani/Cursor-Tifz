const status = document.getElementById('status')
const unlock = document.getElementById('unlock')
const app = document.getElementById('app')
const password = document.getElementById('password')
const search = document.getElementById('search')
const list = document.getElementById('list')
const error = document.getElementById('error')

async function refresh() {
  const s = await chrome.runtime.sendMessage({ type: 'STATUS' })
  if (s.unlocked) {
    unlock.hidden = true
    app.hidden = false
    status.textContent = `${s.count} entri · isi & simpan login website`
    await render('')
  } else {
    unlock.hidden = false
    app.hidden = true
    status.textContent = s.hasBlob ? 'Brankas terkunci' : 'Buka aplikasi web Kunci dulu, lalu kembali ke sini.'
  }
}

async function render(query) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const matches = tab?.url ? await chrome.runtime.sendMessage({ type: 'MATCHES', url: tab.url }) : { matches: [] }
  const searched = await chrome.runtime.sendMessage({ type: 'SEARCH', query })
  const entries = query ? searched.entries : matches.matches?.length ? matches.matches : searched.entries
  list.innerHTML = ''
  for (const e of entries || []) {
    const li = document.createElement('li')
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.innerHTML = `<strong>${escapeHtml(e.name)}</strong><span>${escapeHtml(e.username || e.url || '')}</span>`
    btn.addEventListener('click', async () => {
      if (tab?.id) await chrome.tabs.sendMessage(tab.id, { type: 'FILL_ENTRY', entry: e })
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
  const res = await chrome.runtime.sendMessage({ type: 'UNLOCK', password: password.value })
  if (res?.error) {
    error.textContent = res.error
    return
  }
  password.value = ''
  await refresh()
})

search.addEventListener('input', () => {
  void render(search.value)
})

void refresh()
