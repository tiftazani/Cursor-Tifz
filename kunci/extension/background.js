import './ext-api.js'
import {
  applyLoginCapture,
  decideLoginSave,
  decryptVault,
  decryptWithDek,
  dekFromB64,
  dekToB64,
  hostFromUrl,
  isKunciAppUrl,
  layerFromUrl,
  matchesForUrl,
  persistVault,
} from './crypto.js'

const session = (() => {
  if (chrome.storage?.session) return chrome.storage.session
  const data = Object.create(null)
  const pick = (keys) => {
    if (keys == null) return { ...data }
    const names = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(keys)
    const out = {}
    for (const k of names) {
      if (k in data) out[k] = data[k]
    }
    return out
  }
  return {
    get: async (keys) => pick(keys),
    set: async (obj) => {
      Object.assign(data, obj)
    },
    remove: async (keys) => {
      for (const k of Array.isArray(keys) ? keys : [keys]) delete data[k]
    },
  }
})()

const CLOUD = 'https://kunci.tiftazani-cuciin.workers.dev'
const KUNCI_TAB_URLS = [
  'http://127.0.0.1:8780/*',
  'http://localhost:8780/*',
  'http://127.0.0.1:5173/*',
  'http://localhost:5173/*',
  'http://127.0.0.1:4173/*',
  'http://localhost:4173/*',
  `${CLOUD}/*`,
]

/**
 * The unlocked vault, however it is currently held.
 *
 * Order matters. The in-memory cache is the fast path and the only place the vault is
 * ever kept now. When the service worker is evicted the cache is gone, so the second
 * path decrypts from the encrypted blob on disk using the dek in session storage.
 * Nothing puts the plaintext vault in session storage any more: that is what blew the
 * 10 MB quota and made a big vault look locked while it was open.
 */
async function sessionState() {
  const { unlocked, dekB64, cloudToken } = await session.get(['unlocked', 'dekB64', 'cloudToken'])
  if (!unlocked) return { vault: null, dekB64, cloudToken: cloudToken || '' }
  if (vaultCache.vault) return { vault: vaultCache.vault, dekB64, cloudToken: cloudToken || '' }
  return { vault: await loadVault(), dekB64, cloudToken: cloudToken || '' }
}

/**
 * The decrypted vault, kept in memory instead of in `chrome.storage.session`.
 *
 * Session storage has a 10 MB ceiling. A big vault (4000 entries with 500-byte
 * passwords and 1 KB notes measured 10,175,664 bytes, 97% of the quota) made
 * `session.set` throw `Session storage quota bytes exceeded`, after which every read
 * came back empty and MATCHES answered `locked: true` — the extension claimed the
 * vault was locked while it was open, with no error anywhere. Only the small dek
 * lives in session storage now; the vault is decrypted on demand from the encrypted
 * blob in local storage and cached here, keyed by that blob.
 */
let vaultCache = { blob: null, vault: null }

async function loadVault() {
  const { blob } = await chrome.storage.local.get('blob')
  if (!blob) return null
  const { dekB64, unlocked } = await session.get(['dekB64', 'unlocked'])
  if (!unlocked || !dekB64) return null
  if (vaultCache.blob === blob && vaultCache.vault) return vaultCache.vault
  try {
    const vault = await decryptWithDek(blob, dekFromB64(dekB64))
    vaultCache = { blob, vault }
    return vault
  } catch {
    /* dek mismatch after a password change; the popup will ask to unlock */
    return null
  }
}

async function sessionVault() {
  const { vault, dekB64, cloudToken } = await sessionState()
  return { vault: vault || (await loadVault()), dekB64, cloudToken }
}

async function publicMatches(vault, url) {
  return matchesForUrl(vault.entries, url).map((e) => ({
    id: e.id,
    name: e.name,
    username: e.username || '',
    password: e.password || '',
    totpSecret: e.totpSecret || '',
    url: e.url || '',
    // Which prompt of the site this login belongs to, so the popup can show two
    // credentials on one host as different layers instead of one blob.
    layer: layerFromUrl(e.url || (e.urls || [])[0] || ''),
  }))
}

async function notifyKunciTabs(blob) {
  try {
    const tabs = await chrome.tabs.query({ url: KUNCI_TAB_URLS })
    await Promise.all(
      tabs.map((tab) => (tab.id ? chrome.tabs.sendMessage(tab.id, { type: 'KUNCI_BLOB_FROM_EXT', blob }).catch(() => undefined) : null)),
    )
  } catch {
    /* no kunci tab */
  }
}

async function pushCloud(blob, token) {
  // `credentials: 'include'` matters: without it a cross-origin fetch from the
  // extension carries no cookie at all, so the only credential is the token handed
  // over by the Kunci page. With it, the session cookie the browser already holds is
  // a second chance when that token has gone stale. The worker reads `bearer ||
  // cookie`, so a dead Authorization header hides a live cookie: retry without it.
  const put = (auth) =>
    fetch(`${CLOUD}/api/vault`, {
      method: 'PUT',
      credentials: 'include',
      headers: auth
        ? { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` }
        : { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blob }),
    })
  try {
    let res = await put(token)
    if (res.status === 401 && token) {
      await session.set({ cloudToken: '' })
      res = await put('')
    }
    return res.ok
  } catch {
    /* tab listener still writes IndexedDB */
    return false
  }
}

async function writeVault(vault, dekB64, blob) {
  const dekRaw = dekFromB64(dekB64)
  const nextBlob = await persistVault(vault, dekRaw, blob)
  await chrome.storage.local.set({ blob: nextBlob })
  // Only the dek goes to session storage; the vault itself is cached in memory so a
  // big vault cannot blow the 10 MB session quota and make the extension claim it is
  // locked. The cache is keyed by the blob it was decrypted from, so a write through
  // any path refreshes it.
  await session.set({ unlocked: true, dekB64 })
  vaultCache = { blob: nextBlob, vault }
  const { cloudToken } = await session.get('cloudToken')
  await notifyKunciTabs(nextBlob)
  await pushCloud(nextBlob, cloudToken)
  return nextBlob
}

// Two tabs finishing a login at the same moment both read pendingSaves, both write
// it back, and the second write wins: one captured login is silently lost. Every
// read-modify-write of this map goes through one chain instead.
let pendingChain = Promise.resolve()

// The same hazard one level up: SAVE_LOGIN is a read-modify-write of the whole vault
// (`sessionState` -> decrypt -> `applyLoginCapture` -> `writeVault`, each awaited). Two
// tabs pressing Simpan at once both read the same vault and the second write drops the
// first entry, while both answer `{ok:true, changed:'create'}`. Measured: three runs,
// "Site-a" gone every time. All vault mutations go through this chain.
let vaultChain = Promise.resolve()

function withVault(mutate) {
  const run = vaultChain.then(mutate)
  // Keep the chain alive after a failure, or one error makes every later save a no-op.
  vaultChain = run.catch(() => undefined)
  return run
}

function withPendingSaves(mutate) {
  const run = pendingChain.then(async () => {
    const pendingSaves = (await session.get('pendingSaves')).pendingSaves || {}
    mutate(pendingSaves)
    await session.set({ pendingSaves })
  })
  // Keep the chain alive after a failure, or every later save becomes a no-op.
  pendingChain = run.catch(() => undefined)
  return run
}

async function clearPendingSave(tabId) {
  if (!tabId) return
  await withPendingSaves((pendingSaves) => {
    delete pendingSaves[String(tabId)]
  })
}

async function storePending(tabId, pending) {
  if (!tabId) return
  await withPendingSaves((pendingSaves) => {
    pendingSaves[String(tabId)] = pending
  })
}

async function queueSave(capture, tabId) {
  if (!capture?.password) return { action: 'skip', reason: 'empty' }
  const { vault } = await sessionState()
  const { neverHosts = [] } = await chrome.storage.local.get('neverHosts')
  if (!vault) {
    await storePending(tabId, { capture, action: 'create', needsUnlock: true })
    return { locked: true }
  }
  if (vault.settings?.offerSaveWeb === false) return { action: 'skip' }
  const decision = decideLoginSave(vault.entries || [], capture || {}, neverHosts)
  if (decision.action === 'create' || decision.action === 'update') {
    await storePending(tabId, { capture, action: decision.action })
  }
  return decision
}

async function broadcastToHttpTabs(message) {
  try {
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] })
    await Promise.all(tabs.map((tab) => (tab.id ? chrome.tabs.sendMessage(tab.id, message).catch(() => undefined) : null)))
  } catch {
    /* no tabs */
  }
}

async function onVaultUnlocked() {
  const { vault } = await sessionState()
  const { neverHosts = [] } = await chrome.storage.local.get('neverHosts')
  // Through the same chain: a save landing at this moment must not be overwritten by
  // this consolidation pass, which rebuilds the whole map.
  await withPendingSaves((pendingSaves) => {
    for (const [tabId, pending] of Object.entries(pendingSaves)) {
      if (!pending?.capture || !vault) {
        delete pendingSaves[tabId]
        continue
      }
      const decision = decideLoginSave(vault.entries || [], pending.capture, neverHosts)
      if (decision.action === 'create' || decision.action === 'update') {
        pendingSaves[tabId] = { capture: pending.capture, action: decision.action }
      } else {
        delete pendingSaves[tabId]
      }
    }
  })
  await broadcastToHttpTabs({ type: 'VAULT_UNLOCKED' })
}

async function injectContentScripts() {
  try {
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] })
    await Promise.all(
      tabs.map(async (tab) => {
        if (!tab.id) return
        try {
          // The manifest already injects these at document_idle. Injecting them a
          // second time into a tab that still has them is a SyntaxError: both copies
          // declare the same top-level consts, so the whole batch is discarded. The
          // page keeps running the old, now-orphaned content script and autofill
          // quietly stops working until the tab is reloaded. Reload is the fix.
          const [probe] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => Boolean(globalThis.kunciContentLoaded),
          })
          if (probe?.result) return
          await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content.css'] })
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['ext-api.js', 'login-intent.js', 'login-outcome.js', 'icon-place.js', 'content.js'],
          })
        } catch {
          /* chrome://, PDF, or no host access */
        }
      }),
    )
  } catch {
    /* ignore */
  }
}

/**
 * Bring every open tab back to life after the extension reloaded itself.
 *
 * `chrome.runtime.reload()` does not fire `onInstalled`, so `injectContentScripts()`
 * never ran on that path: every open tab kept a content script whose `chrome.runtime`
 * was dead. The icons stayed visible and did nothing, and worse, the flag
 * `globalThis.kunciContentLoaded` was still true in the page, so the next injection
 * pass skipped the tab and it never recovered. Reload the tabs instead: it is the only
 * way to clear that flag, and a page reload is cheap next to a silently dead autofill.
 */
async function reloadContentScriptTabs() {
  try {
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] })
    await Promise.all(
      tabs.map(async (tab) => {
        if (!tab.id) return
        try {
          await chrome.tabs.reload(tab.id)
        } catch {
          /* tab closed or protected */
        }
      }),
    )
  } catch {
    /* ignore */
  }
}

function ack(sendResponse, work) {
  void Promise.resolve()
    .then(work)
    .catch(() => undefined)
  try {
    sendResponse({ ok: true })
  } catch {
    /* sender already gone */
  }
  return false
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'QUEUE_SAVE') {
    return ack(sendResponse, () => queueSave(msg.capture, sender.tab?.id))
  }
  if (msg.type === 'SYNC' && msg.blob) {
    return ack(sendResponse, async () => {
      await chrome.storage.local.set({ blob: msg.blob })
      const { dekB64, unlocked } = await session.get(['dekB64', 'unlocked'])
      if (unlocked && dekB64) {
        try {
          const vault = await decryptWithDek(msg.blob, dekFromB64(dekB64))
          vaultCache = { blob: msg.blob, vault }
          await session.set({ unlocked: true, dekB64 })
        } catch {
          /* dek mismatch after password change */
        }
      }
    })
  }
  if (msg.type === 'CLOUD_TOKEN') {
    return ack(sendResponse, () => session.set({ cloudToken: msg.token || '' }))
  }
  if (msg.type === 'TOUCH') {
    return ack(sendResponse, () =>
      withVault(async () => {
        const { vault, dekB64 } = await sessionState()
        if (!vault || !dekB64 || !msg.id) return
        const { blob } = await chrome.storage.local.get('blob')
        if (!blob) return
        const entries = (vault.entries || []).map((e) => (e.id === msg.id ? { ...e, lastUsedAt: Date.now() } : e))
        await writeVault({ ...vault, entries }, dekB64, blob)
      }),
    )
  }
  if (msg.type === 'LOCK') {
    vaultCache = { blob: null, vault: null }
    return ack(sendResponse, () => session.remove(['vault', 'unlocked', 'dekB64']))
  }

  const run = async () => {
    if (msg.type === 'SYNC_EXTENSION') {
      await syncUnpackedExtension()
      return { ok: true }
    }
    if (msg.type === 'GET_BLOB') {
      const { blob } = await chrome.storage.local.get('blob')
      return { blob: blob || null }
    }
    if (msg.type === 'UNLOCKED') {
      if (!msg.vault || !msg.dekB64) return { ok: false, error: 'Sesi tidak lengkap' }
      const { blob } = await chrome.storage.local.get('blob')
      vaultCache = { blob: blob || null, vault: msg.vault }
      await session.set({ unlocked: true, dekB64: msg.dekB64 })
      await onVaultUnlocked()
      return { ok: true, count: msg.vault.entries?.length ?? 0 }
    }
    if (msg.type === 'UNLOCK') {
      const { blob } = await chrome.storage.local.get('blob')
      if (!blob) throw new Error('Belum ada brankas. Buka aplikasi Kunci dulu.')
      const { vault, dekRaw } = await decryptVault(blob, msg.password)
      vaultCache = { blob, vault }
      await session.set({ unlocked: true, dekB64: dekToB64(dekRaw) })
      await onVaultUnlocked()
      return { ok: true, count: vault.entries?.length ?? 0 }
    }
    if (msg.type === 'STATUS') {
      const { vault } = await sessionState()
      const { blob } = await chrome.storage.local.get('blob')
      return { unlocked: Boolean(vault), hasBlob: Boolean(blob), count: vault?.entries?.length ?? 0 }
    }
    if (msg.type === 'MATCHES') {
      const { vault } = await sessionState()
      if (!vault) return { locked: true, matches: [] }
      if (isKunciAppUrl(msg.url || '')) return { locked: false, matches: [] }
      return { locked: false, matches: await publicMatches(vault, msg.url), settings: vault.settings || {} }
    }
    if (msg.type === 'SEARCH') {
      const { vault } = await sessionState()
      if (!vault) return { locked: true, entries: [] }
      const q = (msg.query || '').toLowerCase()
      const entries = (vault.entries || [])
        // Notes are not logins: they have no password and cannot be filled. They were
        // listed and clickable, so choosing one sent FILL_ENTRY with an empty password
        // and closed the popup, doing nothing. matchesForUrl already skips them.
        .filter((e) => e.type !== 'note')
        .filter((e) => !q || `${e.name} ${e.username} ${e.url} ${e.appName}`.toLowerCase().includes(q))
        .slice(0, 12)
        .map((e) => ({
          id: e.id,
          name: e.name,
          username: e.username || '',
          password: e.password || '',
          url: e.url || '',
        }))
      return { locked: false, entries }
    }
    if (msg.type === 'OFFER_SAVE') {
      return queueSave(msg.capture, sender.tab?.id)
    }
    if (msg.type === 'GET_PENDING_SAVE') {
      const tabId = sender.tab?.id
      if (!tabId) return { pending: null }
      const pendingSaves = (await session.get('pendingSaves')).pendingSaves || {}
      return { pending: pendingSaves[String(tabId)] || null }
    }
    if (msg.type === 'DISMISS_SAVE') {
      await clearPendingSave(sender.tab?.id)
      return { ok: true }
    }
    if (msg.type === 'SAVE_LOGIN') {
      const result = await withVault(async () => {
        const { vault, dekB64 } = await sessionState()
        if (!vault || !dekB64) return { locked: true }
        const { blob } = await chrome.storage.local.get('blob')
        if (!blob) throw new Error('Brankas tidak ada')
        const next = applyLoginCapture(vault.entries || [], msg.capture)
        await clearPendingSave(sender.tab?.id)
        if (next.changed === 'skip') return { ok: true, changed: 'skip' }
        await writeVault({ ...vault, entries: next.entries }, dekB64, blob)
        return { ok: true, changed: next.changed }
      })
      return result
    }
    if (msg.type === 'NEVER_SAVE') {
      const host = hostFromUrl(msg.url || '')
      if (!host) return { ok: false }
      const { neverHosts = [] } = await chrome.storage.local.get('neverHosts')
      await chrome.storage.local.set({ neverHosts: Array.from(new Set([...neverHosts, host])) })
      await clearPendingSave(sender.tab?.id)
      return { ok: true }
    }
    return { ok: false }
  }
  run()
    .then((value) => {
      try {
        sendResponse(value)
      } catch {
        /* tab already gone */
      }
    })
    .catch((err) => {
      try {
        const message = err instanceof Error ? err.message : String(err)
        sendResponse({ error: message.trim() || 'Kata sandi induk salah' })
      } catch {
        /* tab already gone */
      }
    })
  return true
})

chrome.tabs.onRemoved.addListener((tabId) => {
  void clearPendingSave(tabId)
})

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'fill-login') return
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'FILL_NOW' }).catch(() => undefined)
})

const HELPER_HEALTH = ['http://127.0.0.1:8780/health', 'http://localhost:8780/health']
const STAMP_KEY = 'kunciExtensionStamp'

async function helperExtensionState() {
  for (const url of HELPER_HEALTH) {
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) continue
      const body = await res.json()
      if (body?.extensionStamp) return body
    } catch {
      /* helper off */
    }
  }
  return null
}

async function syncUnpackedExtension() {
  try {
    const remote = await helperExtensionState()
    if (!remote?.extensionStamp) return
    const stored = await chrome.storage.local.get(STAMP_KEY)
    const prev = stored[STAMP_KEY]
    if (prev === remote.extensionStamp) return
    await chrome.storage.local.set({ [STAMP_KEY]: remote.extensionStamp })
    if (!prev) return
    // A reload leaves every open tab with a dead content script (see
    // reloadContentScriptTabs). Put the stamp back first so the reload below does not
    // immediately look like a new version and loop, then revive the tabs before the
    // runtime goes away. The injection has to happen from THIS side of the reload: the
    // new background script cannot inject into a tab whose flag is still set.
    await reloadContentScriptTabs()
    chrome.runtime.reload()
  } catch {
    /* ignore */
  }
}

function startExtensionSync() {
  void syncUnpackedExtension()
  try {
    chrome.alarms?.create('kunci-ext-sync', { periodInMinutes: 0.5 })
  } catch {
    /* no alarms API */
  }
}

try {
  chrome.alarms?.onAlarm?.addListener((alarm) => {
    if (alarm.name === 'kunci-ext-sync') void syncUnpackedExtension()
  })
} catch {
  /* ignore */
}

chrome.runtime.onStartup.addListener(() => {
  startExtensionSync()
})

chrome.runtime.onInstalled.addListener(() => {
  startExtensionSync()
  void injectContentScripts()
})

startExtensionSync()
