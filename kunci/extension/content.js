function send(msg) {
  try {
    if (!chrome.runtime?.id) return Promise.resolve(null)
    return chrome.runtime.sendMessage(msg).catch(() => null)
  } catch {
    return Promise.resolve(null)
  }
}

const intent = globalThis.kunciLoginIntent

function setNativeValue(el, value) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

const BIND_GEN = crypto.randomUUID()
const iconHosts = new Map()

function visibleInput(el) {
  if (!(el instanceof HTMLInputElement) || el.disabled) return false
  if (el.offsetParent === null && el.getClientRects().length === 0) return false
  const style = window.getComputedStyle(el)
  if (style.visibility === 'hidden' || style.display === 'none') return false
  return true
}

function passwordFields() {
  return [...document.querySelectorAll('input[type="password"]')].filter(visibleInput)
}

function fieldSnap(el) {
  return intent.fieldSnapshot(el)
}

function isUsernameInput(el) {
  return el instanceof HTMLInputElement && visibleInput(el) && intent.isUsernameField(fieldSnap(el))
}

function usernameFieldNear(password) {
  const form = password.form
  const scope = form ? [...form.querySelectorAll('input')] : [...document.querySelectorAll('input')]
  const candidates = scope.filter(isUsernameInput)
  const idx = scope.indexOf(password)
  return candidates.reverse().find((el) => scope.indexOf(el) < idx) || candidates[0] || null
}

function kindAround(el) {
  return intent.classifyAround(el).kind
}

function loginPasswordFields() {
  return passwordFields().filter((el) => intent.shouldAutofillKind(kindAround(el)) && intent.isCurrentPasswordField(fieldSnap(el)))
}

function fill(match) {
  const passwords = loginPasswordFields()
  const pw = passwords[0] || passwordFields().filter((el) => intent.isCurrentPasswordField(fieldSnap(el)))[0]
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
let lastKind = 'other'
let autofilled = false
let autofillTried = false
let saveBarHost = null
let otherBarHost = null
let saveOffer = null
let scanTimer = 0
let placeTimer = 0

function readFormCreds(form) {
  const pw = form
    ? [...form.querySelectorAll('input[type="password"]')].find((el) => el.value) || passwordFields()[0]
    : passwordFields()[0]
  const userEl = pw ? usernameFieldNear(pw) : [...document.querySelectorAll('input')].find(isUsernameInput)
  const username = (userEl?.value || lastUsername || '').trim()
  const password = pw?.value || lastPassword || ''
  const kind = pw ? kindAround(pw) : form ? intent.classifyAround(form instanceof Element ? form : document.body).kind : lastKind
  return { username, password, kind }
}

function captureFromEvent(target) {
  const form = target instanceof HTMLElement ? target.closest('form') : null
  const creds = readFormCreds(form)
  if (creds.username) lastUsername = creds.username
  if (creds.password) lastPassword = creds.password
  lastKind = creds.kind
  return creds
}

function iconSvg() {
  return `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="8" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M11 12h10m-3-3v6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`
}

function placeOutside(el, host) {
  const r = el.getBoundingClientRect()
  const size = 28
  if (r.width < 2 || r.height < 2) {
    host.style.display = 'none'
    return
  }
  host.style.display = 'block'
  const pos = globalThis.kunciIconPlace?.iconPosition(
    { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height },
    { width: window.innerWidth, height: window.innerHeight },
    { size },
  ) || { left: r.right + 8, top: Math.round(r.top + (r.height - size) / 2) }
  host.style.left = `${pos.left}px`
  host.style.top = `${pos.top}px`
}

function repositionIcons() {
  for (const [el, host] of iconHosts) {
    if (!el.isConnected) {
      host.remove()
      iconHosts.delete(el)
      continue
    }
    placeOutside(el, host)
  }
}

function ensureButton(pw) {
  if (!intent.shouldAutofillKind(kindAround(pw))) {
    const stale = iconHosts.get(pw)
    if (stale) {
      stale.remove()
      iconHosts.delete(pw)
    }
    return
  }
  if (pw.dataset.kunciBound === BIND_GEN && iconHosts.get(pw)?.isConnected) {
    placeOutside(pw, iconHosts.get(pw))
    return
  }
  const sibling = pw.nextElementSibling
  if (sibling?.classList?.contains('kunci-wrap')) sibling.remove()
  pw.dataset.kunciBound = BIND_GEN
  document.getElementById(`kunci-icon-${pw.dataset.kunciIconId || ''}`)?.remove()

  const host = document.createElement('div')
  const hostId = crypto.randomUUID()
  pw.dataset.kunciIconId = hostId
  host.id = `kunci-icon-${hostId}`
  host.className = 'kunci-icon-host'
  host.style.cssText =
    'position:fixed;z-index:2147483645;width:28px;height:28px;pointer-events:auto;margin:0;padding:0;'
  const shadow = host.attachShadow({ mode: 'closed' })
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'kunci-fill-btn'
  btn.title = 'Isi login dengan Kunci'
  btn.setAttribute('aria-label', 'Isi login dengan Kunci')
  btn.innerHTML = iconSvg()
  const style = document.createElement('style')
  style.textContent = `
    :host { all: initial; }
    button {
      box-sizing: border-box;
      width: 28px; height: 28px;
      display: grid; place-items: center;
      border-radius: 8px;
      border: 1px solid rgba(62, 224, 195, 0.45);
      background: #121820;
      color: #3ee0c3;
      cursor: pointer;
      padding: 0;
    }
    button.locked { color: #f5c16c; border-color: rgba(245, 193, 108, 0.5); }
    button:hover { filter: brightness(1.08); }
  `
  shadow.append(style, btn)
  document.documentElement.appendChild(host)
  iconHosts.set(pw, host)
  placeOutside(pw, host)

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
    } else showMenu(host, matches)
  })
}

function showMenu(anchor, matches) {
  document.querySelector('.kunci-menu')?.remove()
  const menu = document.createElement('div')
  menu.className = 'kunci-menu'
  if (!matches.length) {
    menu.innerHTML =
      '<div class="kunci-empty">Belum ada login untuk situs ini. Masuk seperti biasa — Kunci akan menawar simpan.</div>'
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
      background: #16332e; color: #3ee0c3;
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
  wrap.innerHTML = `<div class="mark">${iconSvg()}</div><div class="copy"><strong></strong><span></span></div>`
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
    title: pending.action === 'update' ? 'Perbarui password masuk di Kunci?' : 'Simpan login ke Kunci?',
    subtitle: capture.username ? `${capture.username} · ${hostName}` : hostName,
    actions: [
      {
        label: pending.action === 'update' ? 'Perbarui' : 'Simpan',
        primary: true,
        onClick: () => {
          void send({ type: 'SAVE_LOGIN', capture }).then((res) => {
            if (res?.locked) {
              showOtherBar({
                title: 'Kunci terkunci',
                subtitle: 'Buka ikon Kunci di toolbar, masukkan kata sandi induk.',
                actions: [{ label: 'Tutup', onClick: () => undefined }],
              })
              return
            }
            if (res?.ok) hideSaveBar()
          })
        },
      },
      {
        label: 'Tidak',
        onClick: () => {
          void send({ type: 'DISMISS_SAVE' }).then(() => hideSaveBar())
        },
      },
      {
        label: 'Bukan form masuk',
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
  const passwords = loginPasswordFields()
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
  if (!intent.shouldOfferSaveKind(creds.kind || lastKind)) return
  const password = creds.password || lastPassword
  const username = creds.username || lastUsername
  if (!password) return
  if (lastFilled && lastFilled.password === password && (lastFilled.username || '') === username) return
  const capture = { url: location.href, username, password }
  const offer = await send({ type: 'OFFER_SAVE', capture })
  if (offer?.locked) {
    showOtherBar({
      title: 'Kunci terkunci',
      subtitle: 'Buka ikon Kunci di toolbar, masukkan kata sandi induk, lalu login ini bisa disimpan.',
      actions: [{ label: 'Tutup', onClick: () => undefined }],
    })
    return
  }
  if (offer?.action !== 'create' && offer?.action !== 'update') return
  showSaveBar({ capture, action: offer.action })
}

async function restorePendingSave() {
  const res = await send({ type: 'GET_PENDING_SAVE' })
  if (!res?.pending?.capture) return
  const st = await send({ type: 'STATUS' })
  if (st?.unlocked) showSaveBar(res.pending)
}

function scan() {
  if (isKunciPage()) return
  keepSaveBar()
  passwordFields().forEach(ensureButton)
  if (!saveOffer) void maybeAutofill()
  repositionIcons()
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
  const pull = () => window.postMessage({ type: 'KUNCI_PULL_BLOB' }, '*')
  pull()
  window.setTimeout(pull, 500)
  window.setTimeout(pull, 2000)
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
    if (!intent.shouldOfferSaveKind(lastKind)) return
    if (lastFilled && lastFilled.password === lastPassword && (lastFilled.username || '') === lastUsername) return
    void send({
      type: 'QUEUE_SAVE',
      capture: { url: location.href, username: lastUsername, password: lastPassword },
    })
  })
  window.addEventListener('scroll', () => {
    window.clearTimeout(placeTimer)
    placeTimer = window.setTimeout(repositionIcons, 16)
  }, true)
  window.addEventListener('resize', repositionIcons)
  void restorePendingSave().finally(() => {
    scan()
    new MutationObserver(() => {
      window.clearTimeout(scanTimer)
      scanTimer = window.setTimeout(scan, 250)
    }).observe(document.documentElement, { childList: true, subtree: true })
  })
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'FILL_NOW') {
      if (!loginPasswordFields().length) return
      void send({ type: 'MATCHES', url: location.href }).then((res) => {
        if (res?.matches?.[0]) fill(res.matches[0])
      })
    }
    if (msg.type === 'FILL_ENTRY') fill(msg.entry)
    if (msg.type === 'SHOW_PENDING_SAVE' && msg.pending) showSaveBar(msg.pending)
    if (msg.type === 'VAULT_UNLOCKED') {
      autofillTried = false
      document.querySelectorAll('.kunci-fill-btn.locked').forEach((btn) => btn.classList.remove('locked'))
      void restorePendingSave()
      void maybeAutofill()
    }
  })
}
