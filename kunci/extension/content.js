function setNativeValue(el, value) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

function passwordFields() {
  return [...document.querySelectorAll('input[type="password"]')].filter((el) => el.offsetParent !== null)
}

function usernameFieldNear(password) {
  const form = password.form
  const scope = form ? [...form.querySelectorAll('input')] : [...document.querySelectorAll('input')]
  const candidates = scope.filter((el) => {
    if (el === password || el.type === 'password' || el.type === 'hidden') return false
    const type = (el.type || 'text').toLowerCase()
    const hint = `${el.name} ${el.id} ${el.autocomplete} ${el.placeholder}`.toLowerCase()
    return (
      type === 'email' ||
      type === 'text' ||
      type === 'tel' ||
      /user|email|login|id|account|nama/.test(hint)
    )
  })
  const idx = scope.indexOf(password)
  return candidates.reverse().find((el) => scope.indexOf(el) < idx) || candidates[0] || null
}

function fill(match) {
  const passwords = passwordFields()
  const pw = passwords[0]
  if (pw && match.password) setNativeValue(pw, match.password)
  const user = pw ? usernameFieldNear(pw) : document.querySelector('input[type="email"], input[autocomplete="username"]')
  if (user && match.username) setNativeValue(user, match.username)
}

function ensureButton(pw) {
  if (pw.dataset.kunciBound) return
  pw.dataset.kunciBound = '1'
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'kunci-fill-btn'
  btn.title = 'Isi dengan Kunci'
  btn.textContent = 'K'
  pw.parentElement?.style && (pw.parentElement.style.position ||= 'relative')
  const wrap = document.createElement('span')
  wrap.className = 'kunci-wrap'
  pw.insertAdjacentElement('afterend', wrap)
  wrap.appendChild(btn)
  btn.addEventListener('click', async (e) => {
    e.preventDefault()
    e.stopPropagation()
    const res = await chrome.runtime.sendMessage({ type: 'MATCHES', url: location.href })
    if (res?.locked) {
      btn.title = 'Buka popup Kunci lalu masukkan kata sandi induk'
      btn.classList.add('locked')
      return
    }
    const matches = res?.matches || []
    if (matches.length === 1) fill(matches[0])
    else showMenu(btn, matches)
  })
}

function showMenu(anchor, matches) {
  document.querySelector('.kunci-menu')?.remove()
  const menu = document.createElement('div')
  menu.className = 'kunci-menu'
  if (!matches.length) {
    menu.innerHTML = '<div class="kunci-empty">Tidak ada login untuk situs ini. Buka aplikasi Kunci.</div>'
  } else {
    for (const m of matches) {
      const item = document.createElement('button')
      item.type = 'button'
      item.textContent = `${m.name}${m.username ? ' · ' + m.username : ''}`
      item.addEventListener('click', () => {
        fill(m)
        menu.remove()
      })
      menu.appendChild(item)
    }
  }
  document.body.appendChild(menu)
  const r = anchor.getBoundingClientRect()
  menu.style.top = `${r.bottom + window.scrollY + 6}px`
  menu.style.left = `${r.left + window.scrollX - 120}px`
  setTimeout(() => {
    const close = (ev) => {
      if (!menu.contains(ev.target)) {
        menu.remove()
        document.removeEventListener('mousedown', close)
      }
    }
    document.addEventListener('mousedown', close)
  }, 0)
}

function scan() {
  passwordFields().forEach(ensureButton)
}

scan()
const mo = new MutationObserver(scan)
mo.observe(document.documentElement, { childList: true, subtree: true })

window.addEventListener('message', (event) => {
  if (event.source !== window) return
  if (event.data?.type === 'KUNCI_VAULT_SYNC' && event.data.blob) {
    chrome.runtime.sendMessage({ type: 'SYNC', blob: event.data.blob })
  }
  if (event.data?.type === 'KUNCI_VAULT_LOCK') {
    chrome.runtime.sendMessage({ type: 'LOCK' })
  }
})

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'FILL_NOW') {
    chrome.runtime.sendMessage({ type: 'MATCHES', url: location.href }, (res) => {
      if (res?.matches?.[0]) fill(res.matches[0])
    })
  }
  if (msg.type === 'FILL_ENTRY') fill(msg.entry)
})
