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

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const run = async () => {
    if (msg.type === 'SYNC' && msg.blob) {
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
      return { ok: true }
    }
    if (msg.type === 'GET_BLOB') {
      const { blob } = await chrome.storage.local.get('blob')
      return { blob: blob || null }
    }
    if (msg.type === 'CLOUD_TOKEN') {
      await chrome.storage.session.set({ cloudToken: msg.token || '' })
      return { ok: true }
    }
    if (msg.type === 'LOCK') {
      await chrome.storage.session.remove(['vault', 'unlocked', 'dekB64'])
      return { ok: true }
    }
    if (msg.type === 'UNLOCK') {
      const { blob } = await chrome.storage.local.get('blob')
      if (!blob) throw new Error('Belum ada brankas. Buka aplikasi Kunci dulu.')
      const { vault, dekRaw } = await decryptVault(blob, msg.password)
      await chrome.storage.session.set({ vault, unlocked: true, dekB64: dekToB64(dekRaw) })
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
      const { vault } = await sessionState()
      if (!vault) return { locked: true }
      if (vault.settings?.offerSaveWeb === false) return { action: 'skip' }
      const { neverHosts = [] } = await chrome.storage.local.get('neverHosts')
      return decideLoginSave(vault.entries || [], msg.capture, neverHosts)
    }
    if (msg.type === 'SAVE_LOGIN') {
      const { vault, dekB64 } = await sessionState()
      if (!vault || !dekB64) return { locked: true }
      const { blob } = await chrome.storage.local.get('blob')
      if (!blob) throw new Error('Brankas tidak ada')
      const next = applyLoginCapture(vault.entries || [], msg.capture)
      if (next.changed === 'skip') return { ok: true, changed: 'skip' }
      await writeVault({ ...vault, entries: next.entries }, dekB64, blob)
      return { ok: true, changed: next.changed }
    }
    if (msg.type === 'NEVER_SAVE') {
      const host = hostFromUrl(msg.url || '')
      if (!host) return { ok: false }
      const { neverHosts = [] } = await chrome.storage.local.get('neverHosts')
      await chrome.storage.local.set({ neverHosts: Array.from(new Set([...neverHosts, host])) })
      return { ok: true }
    }
    if (msg.type === 'TOUCH') {
      const { vault, dekB64 } = await sessionState()
      if (!vault || !dekB64 || !msg.id) return { ok: false }
      const { blob } = await chrome.storage.local.get('blob')
      const entries = (vault.entries || []).map((e) => (e.id === msg.id ? { ...e, lastUsedAt: Date.now() } : e))
      await writeVault({ ...vault, entries }, dekB64, blob)
      return { ok: true }
    }
    return { ok: false }
  }
  run().then(sendResponse).catch((err) => sendResponse({ error: err.message || String(err) }))
  return true
})

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'fill-login') return
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'FILL_NOW' })
})
