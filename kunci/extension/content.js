// Marks this isolated world as already having the Kunci content scripts. background.js
// probes it before re-injecting: a second injection is a SyntaxError (both copies
// declare the same top-level consts), and the discarded batch leaves the tab running
// the old, orphaned script until it is reloaded.
globalThis.kunciContentLoaded = true

function send(msg) {
  try {
    if (!chrome.runtime?.id) return Promise.resolve(null)
    return chrome.runtime.sendMessage(msg).catch(() => null)
  } catch {
    return Promise.resolve(null)
  }
}

function newId() {
  if (typeof globalThis.kunciNewId === 'function') {
    try {
      return globalThis.kunciNewId()
    } catch {
      /* HTTP / isolated world */
    }
  }
  try {
    const c = globalThis.crypto
    if (typeof c?.randomUUID === 'function') {
      try {
        return c.randomUUID()
      } catch {
        /* insecure context */
      }
    }
    if (typeof c?.getRandomValues === 'function') {
      const bytes = new Uint8Array(16)
      c.getRandomValues(bytes)
      bytes[6] = (bytes[6] & 0x0f) | 0x40
      bytes[8] = (bytes[8] & 0x3f) | 0x80
      const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    }
  } catch {
    /* ignore */
  }
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
}

const outcome = globalThis.kunciLoginOutcome || {
  inferLoginOutcome() {
    return 'unknown'
  },
}

const intent = globalThis.kunciLoginIntent || {
  fieldSnapshot() {
    return { tag: 'input', type: '', name: '', id: '', autocomplete: '', placeholder: '', ariaLabel: '' }
  },
  isUsernameField() {
    return false
  },
  isCurrentPasswordField(field) {
    return (field?.type || '') === 'password'
  },
  classifyAround() {
    return { kind: 'other' }
  },
  shapeAround() {
    return 'user-pass'
  },
  isUsernameOnlyStepAround() {
    return false
  },
  shouldAutofillKind() {
    return false
  },
  shouldOfferSaveKind() {
    return false
  },
}

function setNativeValue(el, value) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

const BIND_GEN = newId()
const iconHosts = new Map()
// The button inside each icon host. The shadow root is closed, so
// querySelectorAll can never reach it: the unlocked state has to be cleared
// through a live reference, or the icon stays amber after the vault opens.
const iconButtons = new Map()

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
  try {
    return intent.fieldSnapshot(el)
  } catch {
    return { tag: 'input', type: el?.type || '', name: '', id: '', autocomplete: '', placeholder: '', ariaLabel: '' }
  }
}

function isUsernameInput(el) {
  return el instanceof HTMLInputElement && visibleInput(el) && intent.isUsernameField(fieldSnap(el))
}

function usernameFieldNear(password) {
  const form = password.form
  if (form) {
    const scope = [...form.querySelectorAll('input')]
    const candidates = scope.filter(isUsernameInput)
    const idx = scope.indexOf(password)
    // reverse() mutates, so the fallback below used to return the LAST username box on
    // the page instead of the nearest one. Search a copy, and fall back to the first
    // candidate in document order, which is the one closest to the top of the form.
    return [...candidates].reverse().find((el) => scope.indexOf(el) < idx) || candidates[0] || null
  }
  // No <form>. Searching the whole document made every anonymous text box a
  // candidate, so the username landed in a newsletter email box above the login
  // (verified on /spa: `#newsletter_email` got tif@example.com) or in a promo-code
  // box (/promo). Walk up from the password box instead and take the first container
  // that holds both, stopping before <body>: a box in another section of the page is
  // a different form, and filling nothing beats filling the wrong box.
  const all = [...document.querySelectorAll('input')]
  const candidates = all.filter(isUsernameInput)
  for (let node = password.parentElement; node && node !== document.body; node = node.parentElement) {
    const inside = [...node.querySelectorAll('input')]
    const pwAt = inside.indexOf(password)
    const hit = [...inside].reverse().find((el) => candidates.includes(el) && inside.indexOf(el) < pwAt)
    if (hit) return hit
  }
  return null
}

function kindAround(el) {
  try {
    return intent.classifyAround(el).kind
  } catch {
    return 'other'
  }
}

function shapeAround(el) {
  try {
    return intent.shapeAround ? intent.shapeAround(el) : 'user-pass'
  } catch {
    return 'user-pass'
  }
}

function isUsernameOnlyStepAround(el) {
  try {
    return Boolean(intent.isUsernameOnlyStepAround?.(el))
  } catch {
    return false
  }
}

/** The field the Kunci icon should sit next to on a step with no password box. */
function usernameOnlyField() {
  if (passwordFields().length) return null
  return [...document.querySelectorAll('input')].filter(isUsernameInput).find((el) => isUsernameOnlyStepAround(el)) || null
}

function loginPasswordFields() {
  return passwordFields().filter((el) => intent.shouldAutofillKind(kindAround(el)) && intent.isCurrentPasswordField(fieldSnap(el)))
}

function fill(match) {
  // Only fields the classifier calls a login password box. The old fallback here was
  // `passwordFields()[0]`, the first password input on the page whatever it is, so
  // picking an entry from the popup dropped an unrelated password into a box the
  // classifier had explicitly refused — a transfer PIN, a card PIN, a confirm box.
  const pw = loginPasswordFields()[0]
  if (pw) {
    if (match.password) setNativeValue(pw, match.password)
    // Password-only page: typing a username into the nearest text box would drop it in a
    // search or promo-code field. Leave those pages alone.
    if (match.username && shapeAround(pw) === 'user-pass') {
      const user = usernameFieldNear(pw)
      if (user) setNativeValue(user, match.username)
    }
  } else if (match.username) {
    // Username-first step (Agoda): no password box yet, so only the email lands. Gated by
    // isUsernameOnlyLoginStep, never a blind querySelector on any email box on the page.
    const box = usernameOnlyField()
    if (box) setNativeValue(box, match.username)
  }
  if (match.id) void send({ type: 'TOUCH', id: match.id })
}

/**
 * True only for a page that really is the Kunci app.
 *
 * The scheme matters. Matching on hostname+port alone meant any OTHER local dev
 * server — `npm run dev` in an unrelated Vite project defaults to 5173 — was
 * treated as Kunci, wired into the vault bridge, and could then ask for the
 * encrypted blob or push a replacement one. Loopback http on Kunci's own ports
 * is the app; an https loopback server is somebody else.
 */
function isKunciPage() {
  const { hostname, port, protocol } = location
  if (hostname === 'kunci.tiftazani-cuciin.workers.dev') return protocol === 'https:'
  if (hostname !== '127.0.0.1' && hostname !== 'localhost') return false
  return protocol === 'http:' && ['8780', '5173', '4173'].includes(port)
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
let attempt = null
const ATTEMPT_CHECKS = [400, 1000, 2000, 4000, 7000]

/**
 * What to offer saving, read from the form the user actually submitted.
 *
 * Two bugs lived here. (1) It took the FIRST password box with a value, which on a
 * change-password form (current, new, confirm — the usual order) is the CURRENT
 * password, so "Perbarui" wrote the old password into the vault and threw away the
 * new one the user had just set. (2) When the submitted form had no password box at
 * all — a newsletter signup next to a login form — it fell through to
 * `passwordFields()[0]`, the login form's box, and offered to save a login for a
 * navigation that had nothing to do with it.
 */
function readFormCreds(form) {
  const inForm = form ? [...form.querySelectorAll('input[type="password"]')].filter(visibleInput) : []
  // A submitted form with no password box is not a login. Do not borrow one from
  // elsewhere on the page.
  if (form && !inForm.length) return { username: '', password: '', kind: 'other' }
  const scope = inForm.length ? inForm : passwordFields()
  const filled = scope.filter((el) => el.value)
  // Prefer the NEW password box when the form is a change-password form; otherwise
  // the current one. `isNewPasswordField` already knows new/confirm/retype in both
  // languages and reads autocomplete="new-password".
  const pw = filled.find((el) => intent.isNewPasswordField(fieldSnap(el))) || filled[0] || scope[0]
  const userEl = pw ? usernameFieldNear(pw) : [...document.querySelectorAll('input')].find(isUsernameInput)
  const username = (userEl?.value || lastUsername || '').trim()
  const password = pw?.value || lastPassword || ''
  const kind = pw ? kindAround(pw) : form ? intent.classifyAround(form instanceof Element ? form : document.body).kind : lastKind
  return { username, password, kind, field: pw || null }
}

function tenantValueNear(pw) {
  try {
    const form = pw instanceof Element ? pw.closest('form') : null
    const snap = intent.snapshotForm(form, location.href)
    const userEl = pw ? usernameFieldNear(pw) : null
    const tenantEl = intent.tenantField(snap, userEl ? fieldSnap(userEl) : null)
    if (!tenantEl) return ''
    const dom = findFieldIn(form, tenantEl)
    return ((dom && dom.value) || '').trim()
  } catch {
    return ''
  }
}

function findFieldIn(form, snapshot) {
  const scope = form || document
  for (const el of scope.querySelectorAll('input')) {
    const snap = fieldSnap(el)
    if (snap.name && snap.name === snapshot.name) return el
    if (snap.id && snap.id === snapshot.id) return el
  }
  return null
}

function captureFromEvent(target) {
  const form = target instanceof HTMLElement ? target.closest('form') : null
  const creds = readFormCreds(form)
  // A form with no password box is not a login, and its creds must not overwrite what
  // the real login form just recorded. Without this, submitting a newsletter form
  // reset lastKind to 'other' and a genuine login submit right after it was ignored.
  if (!creds.password) return creds
  if (creds.username) lastUsername = creds.username
  if (creds.password) lastPassword = creds.password
  lastKind = creds.kind
  const tenant = tenantValueNear(creds.field)
  // No tenant box at all is not a missing answer: only a form that has one and was
  // submitted empty is worth warning about.
  const tenantEl = tenantBoxFor(creds.field)
  return { ...creds, tenant, missingTenant: Boolean(tenantEl) && !tenant }
}

function tenantBoxFor(pw) {
  try {
    const form = pw instanceof Element ? pw.closest('form') : null
    const snap = intent.snapshotForm(form, location.href)
    const userEl = pw ? usernameFieldNear(pw) : null
    return intent.tenantField(snap, userEl ? fieldSnap(userEl) : null)
  } catch {
    return null
  }
}

function iconSvg() {
  return `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="8" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M11 12h10m-3-3v6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`
}

/**
 * Interactive neighbours the icon must not cover.
 *
 * The icon is fixed and on top of everything, so whatever it covers stops being
 * clickable. A submit button sitting right of the password box is the common case
 * and the one that used to swallow the user's click.
 */
function clickablesNear(el) {
  const rect = el.getBoundingClientRect()
  const pad = 160
  const near = { left: rect.left - pad, top: rect.top - pad, right: rect.right + pad, bottom: rect.bottom + pad }
  const out = []
  for (const node of document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"], a[href]')) {
    if (node === el || node.closest('.kunci-icon-host')) continue
    const r = node.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) continue
    const b = { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
    if (b.right < near.left || b.left > near.right || b.bottom < near.top || b.top > near.bottom) continue
    out.push(b)
  }
  return out
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
    { size, avoid: clickablesNear(el) },
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

function ensureButton(pw, usernameOnly = false) {
  // A username box on a normal login page must not get its own icon: only password
  // fields, or the explicit username-only step, are eligible.
  const allowed = usernameOnly ? isUsernameOnlyStepAround(pw) : intent.shouldAutofillKind(kindAround(pw))
  if (!allowed) {
    const stale = iconHosts.get(pw)
    if (stale) {
      stale.remove()
      iconHosts.delete(pw)
      iconButtons.delete(pw)
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
  const hostId = newId()
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
  iconButtons.set(pw, btn)
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
      // Two lines, not one: a site with several accounts for the same person differs
      // only in the username, and a single joined label made the rows indistinguishable.
      const who = document.createElement('strong')
      who.textContent = m.name || m.username || 'Tanpa nama'
      item.appendChild(who)
      if (m.username) {
        const user = document.createElement('span')
        user.textContent = m.username
        item.appendChild(user)
      }
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
      box-sizing: border-box;
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
      width: 100%;
      min-width: min(420px, 92vw);
    }
    .mark {
      width: 28px; height: 28px; border-radius: 8px; flex: none;
      display: grid; place-items: center;
      background: #16332e; color: #3ee0c3;
    }
    /* Without a floor the copy is the only item that can give, so a row of long
       account labels squeezed it to zero width and the heading broke into one letter
       per line. Holding a minimum keeps the title readable and makes the action row
       wrap under it instead. */
    .copy { flex: 1 1 auto; min-width: min(180px, 100%); }
    .copy strong { display: block; font-size: 13px; }
    .copy span { display: block; color: #8b97a8; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .copy .notice { display: block; margin-top: 4px; font-style: normal; font-size: 12px; line-height: 1.35; color: #f0b46b; }
    /* The account list. One account per row, and the row has to say WHICH username it
       carries: a row of side-by-side buttons cannot do that once the labels are email
       addresses, and the third one onwards simply did not fit. A long list scrolls
       inside the card instead of running off it. */
    .accounts {
      flex: 1 1 100%;
      display: grid;
      gap: 6px;
      max-height: 240px;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding-right: 2px;
    }
    .accounts button { display: grid; gap: 2px; width: 100%; }
    .accounts .who { font-weight: 600; }
    .accounts .user { color: #8b97a8; font-size: 12px; }
    /* Long labels are the normal case here: an account label is an email address.
       Let a label wrap rather than push the card wider than the viewport. */
    button {
      appearance: none; border: 1px solid rgba(255,255,255,.1); background: #1b232e;
      color: #eef3f8; border-radius: 8px; padding: 7px 10px; cursor: pointer; font: inherit;
      min-height: 32px; height: auto; flex: 0 1 auto;
      max-width: 100%; min-width: 0;
      overflow-wrap: anywhere; text-align: left;
    }
    button.primary { background: #3ee0c3; color: #06241d; border-color: transparent; font-weight: 650; }
  `
}

function mountBar(existing, { title, subtitle, notice, actions, accounts, sticky }) {
  existing?.remove()
  const host = document.createElement('div')
  host.dataset.kunciBar = sticky ? 'save' : 'other'
  host.style.cssText = 'position:fixed;z-index:2147483646;top:12px;left:50%;transform:translateX(-50%);width:min(420px,100vw - 24px)'
  const shadow = host.attachShadow({ mode: 'closed' })
  const wrap = document.createElement('div')
  wrap.className = 'bar'
  wrap.innerHTML = `<div class="mark">${iconSvg()}</div><div class="copy"><strong></strong><span></span><em class="notice"></em></div>`
  wrap.querySelector('strong').textContent = title
  wrap.querySelector('span').textContent = subtitle
  const noticeEl = wrap.querySelector('.notice')
  if (notice) noticeEl.textContent = notice
  else noticeEl.remove()
  const close = () => {
    if (sticky) return
    host.remove()
    if (otherBarHost === host) otherBarHost = null
  }
  // One row per account, each naming its username. Side-by-side buttons could not do
  // that: an account label is an email address, so a row of them ran off the card and
  // the third match onwards was unreachable. A long list scrolls inside the card.
  if (accounts?.length) {
    const list = document.createElement('div')
    list.className = 'accounts'
    for (const account of accounts) {
      const btn = document.createElement('button')
      const who = document.createElement('span')
      who.className = 'who'
      who.textContent = account.name || account.username || 'Tanpa nama'
      btn.appendChild(who)
      if (account.username) {
        const user = document.createElement('span')
        user.className = 'user'
        user.textContent = account.username
        btn.appendChild(user)
      }
      btn.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        close()
        account.onClick()
      })
      list.appendChild(btn)
    }
    wrap.appendChild(list)
  }
  for (const action of actions || []) {
    const btn = document.createElement('button')
    if (action.primary) btn.className = 'primary'
    btn.textContent = action.label
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      close()
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
    subtitle: `${capture.tenant ? `Perusahaan: ${capture.tenant} · ` : ''}${capture.username ? `${capture.username} · ${hostName}` : hostName}`,
    notice: '',
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
            if (res?.ok) {
              hideSaveBar()
              return
            }
            // `background.js` answers `{error}` for any thrown save, and an over-quota
            // blob is a real one. Leaving the bar up with no message made the user
            // press Simpan again with no idea it had failed.
            showOtherBar({
              title: 'Gagal menyimpan',
              subtitle: res?.error || 'Login ini tidak tersimpan. Coba lagi.',
              actions: [{ label: 'Tutup', onClick: () => undefined }],
            })
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
  // A username-first step has no password box yet, but it is still a login the vault
  // can answer. Agoda's sign-in page keeps its email box in an iframe and asks for the
  // password on the next screen; with only the password branch, nothing appeared there.
  const userOnly = passwords.length ? null : usernameOnlyField()
  if (!passwords.length && !userOnly) return
  autofillTried = true
  if (passwords.some((el) => el.value)) return
  if (userOnly?.value) return
  const res = await send({ type: 'MATCHES', url: location.href })
  if (res?.locked || !res?.matches?.length) return
  if (res.settings?.autoFillWeb === false) return
  // Only a real password step is filled silently. A username-first step shows the list
  // first: filling it blind would put an email in the box with no sign of which account
  // it came from, and the user has not reached the password prompt yet.
  if (res.matches.length === 1 && !userOnly) {
    fill(res.matches[0])
    lastFilled = res.matches[0]
    autofilled = true
    return
  }
  showOtherBar({
    title: 'Pilih login Kunci',
    subtitle: `${res.matches.length} akun untuk ${location.hostname}`,
    accounts: res.matches.map((m) => ({
      name: m.name,
      username: m.username,
      onClick: () => {
        fill(m)
        lastFilled = m
        autofilled = true
      },
    })),
  })
}

function outcomeFromDom(submittedUrl, elapsedMs) {
  const passwords = loginPasswordFields()
  const passwordFieldVisible = passwords.length > 0
  const loginFormVisible = passwords.some((el) => intent.shouldOfferSaveKind(kindAround(el)))
  const passwordFieldInvalid = passwords.some((el) => el.getAttribute('aria-invalid') === 'true')
  let pageText = ''
  try {
    pageText = (document.body?.innerText || '').slice(0, 6000)
  } catch {
    /* ignore */
  }
  return outcome.inferLoginOutcome({
    submittedUrl,
    currentUrl: location.href,
    passwordFieldVisible,
    loginFormVisible,
    passwordFieldInvalid,
    pageText,
    elapsedMs,
  })
}

function clearAttempt(dismiss) {
  if (attempt?.timers) {
    for (const id of attempt.timers) window.clearTimeout(id)
  }
  attempt = null
  if (dismiss) void send({ type: 'DISMISS_SAVE' })
}

function beginAttempt(creds) {
  if (isKunciPage()) return
  if (!intent.shouldOfferSaveKind(creds.kind || lastKind)) return
  const password = creds.password || lastPassword
  const username = creds.username || lastUsername
  if (!password) return
  if (lastFilled && lastFilled.password === password && (lastFilled.username || '') === username) return
  clearAttempt(false)
  hideSaveBar()
  attempt = {
    username,
    password,
    url: location.href,
    kind: creds.kind || lastKind,
    startedAt: Date.now(),
    timers: [],
  }
  for (const ms of ATTEMPT_CHECKS) {
    attempt.timers.push(window.setTimeout(() => void checkAttempt(), ms))
  }
}

async function checkAttempt() {
  if (!attempt) return
  const elapsed = Date.now() - attempt.startedAt
  const result = outcomeFromDom(attempt.url, elapsed)
  if (result === 'success') {
    const creds = { username: attempt.username, password: attempt.password, kind: attempt.kind, url: location.href }
    clearAttempt(false)
    await maybeOfferSave(creds)
    return
  }
  if (result === 'failure') {
    clearAttempt(true)
    hideSaveBar()
    return
  }
  if (elapsed >= ATTEMPT_CHECKS[ATTEMPT_CHECKS.length - 1]) clearAttempt(false)
}

async function maybeOfferSave(creds) {
  if (isKunciPage()) return
  if (!intent.shouldOfferSaveKind(creds.kind || lastKind)) return
  const password = creds.password || lastPassword
  const username = creds.username || lastUsername
  if (!password) return
  if (lastFilled && lastFilled.password === password && (lastFilled.username || '') === username) return
  const capture = {
    url: creds.url || location.href,
    username,
    password,
    submittedUrl: creds.submittedUrl || creds.url || location.href,
  }
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

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

/**
 * The host of this page, plus the host of every iframe on it, read from the DOM.
 *
 * A site may keep its whole login form in an iframe on another host (a sign-in
 * service), and the iframe's `src` attribute is readable from the top document even
 * when the frame itself is cross-origin. Without this the top frame would judge the
 * pending save as belonging to a different site and dismiss it.
 */
function pageHosts() {
  const hosts = [location.hostname.replace(/^www\./, '').toLowerCase()]
  try {
    for (const frame of document.querySelectorAll('iframe[src]')) {
      try {
        const host = new URL(frame.getAttribute('src'), location.href).hostname.replace(/^www\./, '').toLowerCase()
        if (host) hosts.push(host)
      } catch {
        /* unparsable src */
      }
    }
  } catch {
    /* no DOM */
  }
  return hosts
}

/** True when the submitted URL belongs to this page or to a login frame on it. */
function pendingBelongsHere(submitted) {
  let target = ''
  try {
    target = new URL(submitted).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return true
  }
  if (!target) return true
  return pageHosts().includes(target)
}

async function restorePendingSave() {
  // A pending save is keyed by TAB, and the content scripts now run in every frame, so
  // each frame would read the same entry. Showing the bar from every frame would stack
  // it once per frame; letting every frame judge it would let a frame whose host does
  // not match DISMISS the save before the right frame read it. Only the top frame acts,
  // which is also the frame the user is looking at.
  if (window !== window.top) return
  // The save that this page is about to be told about may still be landing: the tab
  // that logged in sent QUEUE_SAVE as it was being torn down, and this page's
  // GET_PENDING_SAVE can arrive before the write finishes. The read used to lose that
  // race every single time (0/8 runs) and the bar never appeared. Give the write a few
  // chances before concluding there is nothing to restore.
  let res = await send({ type: 'GET_PENDING_SAVE' })
  for (let i = 0; i < 6 && !res?.pending?.capture; i++) {
    await sleep(150)
    res = await send({ type: 'GET_PENDING_SAVE' })
  }
  if (!res?.pending?.capture) return
  await sleep(400)
  const submitted = res.pending.capture.submittedUrl || res.pending.capture.url || location.href
  if (!pendingBelongsHere(submitted)) {
    void send({ type: 'DISMISS_SAVE' })
    return
  }
  const result = outcomeFromDom(submitted, 2000)
  if (result === 'failure') {
    void send({ type: 'DISMISS_SAVE' })
    return
  }
  if (result !== 'success') return
  const st = await send({ type: 'STATUS' })
  if (st?.unlocked) showSaveBar(res.pending)
}

function hookNavigation() {
  const fire = () => window.setTimeout(() => void checkAttempt(), 50)
  try {
    window.addEventListener('popstate', fire)
    window.addEventListener('hashchange', fire)
  } catch {
    /* ignore */
  }
  try {
    window.navigation?.addEventListener?.('navigate', fire)
  } catch {
    /* ignore */
  }
  for (const type of ['pushState', 'replaceState']) {
    try {
      const orig = history[type]
      if (typeof orig !== 'function') continue
      history[type] = function hookedNav(...args) {
        const ret = orig.apply(this, args)
        fire()
        return ret
      }
    } catch {
      /* some sites freeze History */
    }
  }
}

function scan() {
  try {
    if (isKunciPage()) return
    keepSaveBar()
    const passwords = passwordFields()
    // Not `passwords.forEach(ensureButton)`: forEach passes the index as the second
    // argument, which lands in `usernameOnly`. Every field after the first was then
    // judged by the username-only-step rule instead of the normal autofill rule, so
    // the icon went missing on the second password box of a page.
    for (const pw of passwords) ensureButton(pw)
    // Agoda-style step: only the email box exists, so the icon has nowhere else to sit.
    const userOnly = usernameOnlyField()
    if (userOnly) ensureButton(userOnly, true)
    // Step two arrived: drop the icon that was sitting on the email box.
    if (passwords.length) {
      for (const [el, host] of iconHosts) {
        if (!passwords.includes(el)) {
          host.remove()
          iconHosts.delete(el)
        }
      }
    }
    if (!saveOffer) void maybeAutofill()
    repositionIcons()
  } catch {
    /* jangan spam chrome://extensions Errors */
  }
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
  void send({ type: 'SYNC_EXTENSION' })
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
      beginAttempt(creds)
    },
    true,
  )
  document.addEventListener(
    'click',
    (e) => {
      const t = e.target instanceof Element ? e.target.closest('button, input[type="submit"]') : null
      if (!t) return
      const creds = captureFromEvent(t)
      if (creds.password) beginAttempt(creds)
    },
    true,
  )
  window.addEventListener('pagehide', () => {
    if (!attempt?.password) return
    void send({
      type: 'QUEUE_SAVE',
      capture: {
        url: attempt.url,
        username: attempt.username,
        password: attempt.password,
        submittedUrl: attempt.url,
      },
    })
  })
  window.addEventListener('scroll', () => {
    window.clearTimeout(placeTimer)
    placeTimer = window.setTimeout(repositionIcons, 16)
  }, true)
  window.addEventListener('resize', repositionIcons)
  hookNavigation()
  void restorePendingSave().finally(() => {
    scan()
    const root = document.documentElement
    if (!root) return
    new MutationObserver(() => {
      window.clearTimeout(scanTimer)
      scanTimer = window.setTimeout(() => {
        scan()
        if (attempt) void checkAttempt()
      }, 250)
    }).observe(root, { childList: true, subtree: true })
  })
  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'FILL_NOW') {
        if (!loginPasswordFields().length) return
        void send({ type: 'MATCHES', url: location.href }).then((res) => {
          if (res?.matches?.[0]) fill(res.matches[0])
        })
      }
      if (msg.type === 'FILL_ENTRY') fill(msg.entry)
      if (msg.type === 'SHOW_PENDING_SAVE' && msg.pending) {
        const submitted = msg.pending.capture?.submittedUrl || msg.pending.capture?.url || location.href
        if (outcomeFromDom(submitted, 2000) === 'success') showSaveBar(msg.pending)
      }
      if (msg.type === 'VAULT_UNLOCKED') {
        autofillTried = false
        for (const btn of iconButtons.values()) btn.classList.remove('locked')
        void restorePendingSave()
        void maybeAutofill()
      }
    })
  } catch {
    /* extension context invalidated */
  }
}
