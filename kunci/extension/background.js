import {
  applyLoginCapture,
  decideLoginSave,
  decryptVault,
  decryptWithDek,
  dekFromB64,
  dekToB64,
  hostFromUrl,
  isKunciAppUrl,
  matchesForUrl,
  persistVault,
} from './crypto.js'

const CLOUD = 'https://kunci-tifta.netlify.app'
const KUNCI_TAB_URLS = [
  'http://127.0.0.1:8780/*',
  'http://localhost:8780/*',
  'http://127.0.0.1:5173/*',
  'http://localhost:5173/*',
  'http://127.0.0.1:4173/*',
  'http://localhost:4173/*',
  `${CLOUD}/*`,
]

async function sessionState() {
  const { vault, unlocked, dekB64, cloudToken } = await chrome.storage.session.get(['vault', 'unlocked', 'dekB64', 'cloudToken'])
  return { vault: unlocked ? vault : null, dekB64, cloudToken: cloudToken || '' }
}

async function publicMatches(vault, url) {
  return matchesForUrl(vault.entries, url).map((e) => ({
    id: e.id,
    name: e.name,
    username: e.username || '',
    password: e.password || '',
    totpSecret: e.totpSecret || '',
    url: e.url || '',
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
  if (!token) return
  try {
    await fetch(`${CLOUD}/api/vault`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ blob }),
    })
  } catch {
    /* tab listener still writes IndexedDB */
  }
}

async function writeVault(vault, dekB64, blob) {
  const dekRaw = dekFromB64(dekB64)
  const nextBlob = await persistVault(vault, dekRaw, blob)
  await chrome.storage.local.set({ blob: nextBlob })
  await chrome.storage.session.set({ vault, unlocked: true, dekB64 })
  const { cloudToken } = await chrome.storage.session.get('cloudToken')
  await notifyKunciTabs(nextBlob)
  await pushCloud(nextBlob, cloudToken)
  return nextBlob
}

async function clearPendingSave(tabId) {
  if (!tabId) return
  const pendingSaves = (await chrome.storage.session.get('pendingSaves')).pendingSaves || {}
  delete pendingSaves[String(tabId)]
  await chrome.storage.session.set({ pendingSaves })
}

async function storePending(tabId, pending) {
  if (!tabId) return
  const pendingSaves = (await chrome.storage.session.get('pendingSaves')).pendingSaves || {}
  pendingSaves[String(tabId)] = pending
  await chrome.storage.session.set({ pendingSaves })
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
  const pendingSaves = (await chrome.storage.session.get('pendingSaves')).pendingSaves || {}
  const next = {}
  for (const [tabId, pending] of Object.entries(pendingSaves)) {
    if (!pending?.capture || !vault) continue
    const decision = decideLoginSave(vault.entries || [], pending.capture, neverHosts)
    if (decision.action === 'create' || decision.action === 'update') {
      next[tabId] = { capture: pending.capture, action: decision.action }
    }
  }
  await chrome.storage.session.set({ pendingSaves: next })
  await broadcastToHttpTabs({ type: 'VAULT_UNLOCKED' })
}

async function injectContentScripts() {
  try {
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] })
    await Promise.all(
      tabs.map(async (tab) => {
        if (!tab.id) return
        try {
          await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content.css'] })
          await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['login-intent.js', 'content.js'] })
        } catch {
          /* chrome://, PDF, or no host access */
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
      const { dekB64, unlocked } = await chrome.storage.session.get(['dekB64', 'unlocked'])
      if (unlocked && dekB64) {
        try {
          const vault = await decryptWithDek(msg.blob, dekFromB64(dekB64))
          await chrome.storage.session.set({ vault, unlocked: true, dekB64 })
        } catch {
          /* dek mismatch after password change */
        }
      }
    })
  }
  if (msg.type === 'CLOUD_TOKEN') {
    return ack(sendResponse, () => chrome.storage.session.set({ cloudToken: msg.token || '' }))
  }
  if (msg.type === 'TOUCH') {
    return ack(sendResponse, async () => {
      const { vault, dekB64 } = await sessionState()
      if (!vault || !dekB64 || !msg.id) return
      const { blob } = await chrome.storage.local.get('blob')
      if (!blob) return
      const entries = (vault.entries || []).map((e) => (e.id === msg.id ? { ...e, lastUsedAt: Date.now() } : e))
      await writeVault({ ...vault, entries }, dekB64, blob)
    })
  }
  if (msg.type === 'LOCK') {
    return ack(sendResponse, () => chrome.storage.session.remove(['vault', 'unlocked', 'dekB64']))
  }

  const run = async () => {
    if (msg.type === 'GET_BLOB') {
      const { blob } = await chrome.storage.local.get('blob')
      return { blob: blob || null }
    }
    if (msg.type === 'UNLOCKED') {
      if (!msg.vault || !msg.dekB64) return { ok: false, error: 'Sesi tidak lengkap' }
      await chrome.storage.session.set({ vault: msg.vault, unlocked: true, dekB64: msg.dekB64 })
      await onVaultUnlocked()
      return { ok: true, count: msg.vault.entries?.length ?? 0 }
    }
    if (msg.type === 'UNLOCK') {
      const { blob } = await chrome.storage.local.get('blob')
      if (!blob) throw new Error('Belum ada brankas. Buka aplikasi Kunci dulu.')
      const { vault, dekRaw } = await decryptVault(blob, msg.password)
      await chrome.storage.session.set({ vault, unlocked: true, dekB64: dekToB64(dekRaw) })
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
      const pendingSaves = (await chrome.storage.session.get('pendingSaves')).pendingSaves || {}
      return { pending: pendingSaves[String(tabId)] || null }
    }
    if (msg.type === 'DISMISS_SAVE') {
      await clearPendingSave(sender.tab?.id)
      return { ok: true }
    }
    if (msg.type === 'SAVE_LOGIN') {
      const { vault, dekB64 } = await sessionState()
      if (!vault || !dekB64) return { locked: true }
      const { blob } = await chrome.storage.local.get('blob')
      if (!blob) throw new Error('Brankas tidak ada')
      const next = applyLoginCapture(vault.entries || [], msg.capture)
      await clearPendingSave(sender.tab?.id)
      if (next.changed === 'skip') return { ok: true, changed: 'skip' }
      await writeVault({ ...vault, entries: next.entries }, dekB64, blob)
      return { ok: true, changed: next.changed }
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

chrome.runtime.onInstalled.addListener(() => {
  void injectContentScripts()
})
