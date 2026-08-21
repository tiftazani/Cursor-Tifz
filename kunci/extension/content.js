function send(msg) {
  try {
    if (!chrome.runtime?.id) return Promise.resolve(null)
    return chrome.runtime.sendMessage(msg).catch(() => null)
  } catch {
    return Promise.resolve(null)
  }
}

function setNativeValue(el, value) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

function passwordFields() {
  return [...document.querySelectorAll('input[type="password"]:not([disabled])')].filter((el) => el.offsetParent !== null || el.getClientRects().length)
}

function isUsernameInput(el) {
  if (!(el instanceof HTMLInputElement) || el.type === 'password' || el.type === 'hidden' || el.type === 'checkbox') return false
  const type = (el.type || 'text').toLowerCase()
  const hint = `${el.name} ${el.id} ${el.autocomplete} ${el.placeholder} ${el.getAttribute('aria-label') || ''}`.toLowerCase()
  return type === 'email' || type === 'text' || type === 'tel' || /user|email|login|id|account|nama/.test(hint)
}

function usernameFieldNear(password) {
  const form = password.form
  const scope = form ? [...form.querySelectorAll('input')] : [...document.querySelectorAll('input')]
  const candidates = scope.filter(isUsernameInput)
  const idx = scope.indexOf(password)
  return candidates.reverse().find((el) => scope.indexOf(el) < idx) || candidates[0] || null
}

function fill(match) {
  const passwords = passwordFields()
  const pw = passwords[0]
  if (pw && match.password) setNativeValue(pw, match.password)
  const user = pw ? usernameFieldNear(pw) : document.querySelector('input[type="email"], input[autocomplete="username"]')
  if (user && match.username) setNativeValue(user, match.username)
  if (match.id) void send({ type: 'TOUCH', id: match.id })
}

function isKunciPage() {
  const { hostname, port } = location
  if (hostname === 'kunci-tifta.netlify.app') return true
  return (hostname === '127.0.0.1' || hostname === 'localhost') && ['8780', '5173', '4173'].includes(port)
}

let lastUsername = ''
let lastPassword = ''
let lastFilled = null
let autofilled = false
let autofillTried = false
let saveBarHost = null
let otherBarHost = null
let saveOffer = null
let scanTimer = 0

function readFormCreds(form) {
  const pw = form
    ? [...form.querySelectorAll('input[type="password"]')].find((el) => el.value) || passwordFields()[0]
    : passwordFields()[0]
  const userEl = pw ? usernameFieldNear(pw) : [...document.querySelectorAll('input')].find(isUsernameInput)
  const username = (userEl?.value || lastUsername || '').trim()
  const password = pw?.value || lastPassword || ''
  return { username, password }
}

function captureFromEvent(target) {
  const form = target instanceof HTMLElement ? target.closest('form') : null
  const creds = readFormCreds(form)
  if (creds.username) lastUsername = creds.username
  if (creds.password) lastPassword = creds.password
  return creds
}

function ensureButton(pw) {
  if (pw.dataset.kunciBound) return
  pw.dataset.kunciBound = '1'
  const wrap = document.createElement('span')
  wrap.className = 'kunci-wrap'
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'kunci-fill-btn'
  btn.title = 'Isi dengan Kunci'
  btn.textContent = 'K'
  wrap.appendChild(btn)
  pw.insertAdjacentElement('afterend', wrap)
  btn.addEventListener('click', async (e) => {
    e.preventDefault()
    e.stopPropagation()
    const res = await send({ type: 'MATCHES', url: location.href })
    if (!res) return
    if (res.locked) {
      btn.title = 'Buka ikon Kunci di toolbar, masukkan kata sandi induk'
      btn.classList.add('locked')
      showOtherBar({
        title: 'Kunci terkunci',
        subtitle: 'Buka ikon Kunci di toolbar, masukkan kata sandi induk.',
        actions: [{ label: 'Tutup', onClick: () => undefined }],
      })
      return
    }
    const matches = res?.matches || []
    if (matches.length === 1) {
      fill(matches[0])
      lastFilled = matches[0]
    } else showMenu(btn, matches)
  })
}

function showMenu(anchor, matches) {
  document.querySelector('.kunci-menu')?.remove()
  const menu = document.createElement('div')
  menu.className = 'kunci-menu'
  if (!matches.length) {
    menu.innerHTML = '<div class="kunci-empty">Belum ada login untuk situs ini. Masuk seperti biasa — Kunci akan menawar simpan.</div>'
  } else {
    for (const m of matches) {
      const item = document.createElement('button')
      item.type = 'button'
      item.textContent = `${m.name}${m.username ? ' · ' + m.username : ''}`
      item.addEventListener('click', () => {
        fill(m)
        lastFilled = m
        menu.remove()
      })
      menu.appendChild(item)
    }
  }
  document.body.appendChild(menu)
  const r = anchor.getBoundingClientRect()
  menu.style.top = `${r.bottom + window.scrollY + 6}px`
  menu.style.left = `${Math.max(8, r.left + window.scrollX - 80)}px`
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

function barStyles() {
  return `
    :host { all: initial; }
    .bar {
      font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #eef3f8;
      background: #12171f;
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 12px;
      box-shadow: 0 16px 40px rgba(0,0,0,.4);
      padding: 10px 12px;
      display: flex;
      gap: 10px;
      align-items: center;
      min-width: min(420px, 92vw);
    }
    .mark {
      width: 28px; height: 28px; border-radius: 8px; flex: none;
      display: grid; place-items: center;
      background: #16332e; color: #3ee0c3; font-weight: 800;
    }
    .copy { flex: 1; min-width: 0; }
    .copy strong { display: block; font-size: 13px; }
    .copy span { color: #8b97a8; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    button {
      appearance: none; border: 1px solid rgba(255,255,255,.1); background: #1b232e;
      color: #eef3f8; border-radius: 8px; padding: 7px 10px; cursor: pointer; font: inherit; height: 32px;
    }
    button.primary { background: #3ee0c3; color: #06241d; border-color: transparent; font-weight: 650; }
  `
}

function mountBar(existing, { title, subtitle, actions, sticky }) {
  existing?.remove()
  const host = document.createElement('div')
  host.dataset.kunciBar = sticky ? 'save' : 'other'
  host.style.cssText = 'position:fixed;z-index:2147483646;top:12px;left:50%;transform:translateX(-50%);'
  const shadow = host.attachShadow({ mode: 'closed' })
  const wrap = document.createElement('div')
  wrap.className = 'bar'
  wrap.innerHTML = `<div class="mark">K</div><div class="copy"><strong></strong><span></span></div>`
  wrap.querySelector('strong').textContent = title
  wrap.querySelector('span').textContent = subtitle
  for (const action of actions) {
    const btn = document.createElement('button')
    if (action.primary) btn.className = 'primary'
    btn.textContent = action.label
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (!sticky) {
        host.remove()
        if (otherBarHost === host) otherBarHost = null
      }
      action.onClick()
    })
    wrap.appendChild(btn)
  }
  const style = document.createElement('style')
  style.textContent = barStyles()
  shadow.append(style, wrap)
  document.documentElement.appendChild(host)
  return host
}

function showOtherBar(opts) {
  if (saveOffer && saveBarHost) return
  otherBarHost = mountBar(otherBarHost, { ...opts, sticky: false })
}

function showSaveBar(pending) {
  saveOffer = pending
  otherBarHost?.remove()
  otherBarHost = null
  const capture = pending.capture
  const hostName = (() => {
    try {
      return new URL(capture.url).hostname.replace(/^www\./, '')
    } catch {
      return location.hostname.replace(/^www\./, '')
    }
  })()
  saveBarHost = mountBar(saveBarHost, {
    sticky: true,
    title: pending.action === 'update' ? 'Perbarui password di Kunci?' : 'Simpan password di Kunci?',
    subtitle: capture.username ? `${capture.username} · ${hostName}` : hostName,
    actions: [
      {
        label: pending.action === 'update' ? 'Perbarui' : 'Simpan',
        primary: true,
        onClick: () => {
          void send({ type: 'SAVE_LOGIN', capture }).then(() => hideSaveBar())
        },
      },
      {
        label: 'Tidak',
        onClick: () => {
          void send({ type: 'DISMISS_SAVE' }).then(() => hideSaveBar())
        },
      },
      {
        label: 'Jangan untuk situs ini',
        onClick: () => {
          void send({ type: 'NEVER_SAVE', url: capture.url }).then(() => hideSaveBar())
        },
      },
    ],
  })
}

function hideSaveBar() {
  saveOffer = null
  saveBarHost?.remove()
  saveBarHost = null
}

function keepSaveBar() {
  if (!saveOffer) return
  if (!saveBarHost || !saveBarHost.isConnected) showSaveBar(saveOffer)
}

async function maybeAutofill() {
  if (autofillTried || autofilled || isKunciPage()) return
  const passwords = passwordFields()
  if (!passwords.length) return
  autofillTried = true
  if (passwords.some((el) => el.value)) return
  const res = await send({ type: 'MATCHES', url: location.href })
  if (res?.locked || !res?.matches?.length) return
  if (res.settings?.autoFillWeb === false) return
  if (res.matches.length === 1) {
    fill(res.matches[0])
    lastFilled = res.matches[0]
    autofilled = true
    return
  }
  showOtherBar({
    title: 'Pilih login Kunci',
    subtitle: `${res.matches.length} akun untuk ${location.hostname}`,
    actions: res.matches.slice(0, 3).map((m) => ({
      label: m.username || m.name,
      primary: false,
      onClick: () => {
        fill(m)
        lastFilled = m
        autofilled = true
      },
    })),
  })
}

async function maybeOfferSave(creds) {
  if (isKunciPage()) return
  const password = creds.password || lastPassword
  const username = creds.username || lastUsername
  if (!password) return
  if (lastFilled && lastFilled.password === password && (lastFilled.username || '') === username) return
  const capture = { url: location.href, username, password }
  const offer = await send({ type: 'OFFER_SAVE', capture })
  if (offer?.locked) return
  if (offer?.action !== 'create' && offer?.action !== 'update') return
  showSaveBar({ capture, action: offer.action })
}

async function restorePendingSave() {
  const res = await send({ type: 'GET_PENDING_SAVE' })
  if (res?.pending?.capture) showSaveBar(res.pending)
}

function scan() {
  if (isKunciPage()) return
  keepSaveBar()
  passwordFields().forEach(ensureButton)
  if (!saveOffer) void maybeAutofill()
}

function wireKunciBridge() {
  const sendToken = () => {
    try {
      void send({ type: 'CLOUD_TOKEN', token: window.localStorage.getItem('kunci_cloud_token') || '' })
    } catch {
      /* ignore */
    }
  }
  sendToken()
  window.addEventListener('storage', sendToken)
  window.addEventListener('message', (event) => {
    if (event.source !== window) return
    if (event.data?.type === 'KUNCI_VAULT_SYNC' && event.data.blob) {
      void send({ type: 'SYNC', blob: event.data.blob })
    }
    if (event.data?.type === 'KUNCI_VAULT_LOCK') {
      void send({ type: 'LOCK' })
    }
    if (event.data?.type === 'KUNCI_REQUEST_BLOB') {
      void send({ type: 'GET_BLOB' }).then((res) => {
        if (res?.blob) window.postMessage({ type: 'KUNCI_BLOB_FROM_EXT', blob: res.blob }, '*')
      })
    }
  })
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'KUNCI_BLOB_FROM_EXT' && msg.blob) {
      window.postMessage({ type: 'KUNCI_BLOB_FROM_EXT', blob: msg.blob }, '*')
    }
  })
}

if (isKunciPage()) {
  wireKunciBridge()
} else {
  document.addEventListener(
    'input',
    (e) => {
      const t = e.target
      if (!(t instanceof HTMLInputElement)) return
      if (t.type === 'password' && t.value) lastPassword = t.value
      else if (isUsernameInput(t) && t.value) lastUsername = t.value
    },
    true,
  )
  document.addEventListener(
    'submit',
    (e) => {
      const creds = captureFromEvent(e.target)
      void maybeOfferSave(creds)
    },
    true,
  )
  document.addEventListener(
    'click',
    (e) => {
      const t = e.target instanceof Element ? e.target.closest('button, input[type="submit"]') : null
      if (!t) return
      const creds = captureFromEvent(t)
      if (creds.password) void maybeOfferSave(creds)
    },
    true,
  )
  window.addEventListener('pagehide', () => {
    if (!lastPassword) return
    if (lastFilled && lastFilled.password === lastPassword && (lastFilled.username || '') === lastUsername) return
    void send({
      type: 'QUEUE_SAVE',
      capture: { url: location.href, username: lastUsername, password: lastPassword },
    })
  })
  void restorePendingSave().finally(() => {
    scan()
    new MutationObserver(() => {
      window.clearTimeout(scanTimer)
      scanTimer = window.setTimeout(scan, 250)
    }).observe(document.documentElement, { childList: true, subtree: true })
  })
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'FILL_NOW') {
      void send({ type: 'MATCHES', url: location.href }).then((res) => {
        if (res?.matches?.[0]) fill(res.matches[0])
      })
    }
    if (msg.type === 'FILL_ENTRY') fill(msg.entry)
    if (msg.type === 'SHOW_PENDING_SAVE' && msg.pending) showSaveBar(msg.pending)
  })
}
