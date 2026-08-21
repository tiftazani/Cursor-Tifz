import { decryptVault, matchesForUrl } from './crypto.js'

async function getSession() {
  const { vault, unlocked } = await chrome.storage.session.get(['vault', 'unlocked'])
  return unlocked ? vault : null
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const run = async () => {
    if (msg.type === 'SYNC' && msg.blob) {
      await chrome.storage.local.set({ blob: msg.blob })
      return { ok: true }
    }
    if (msg.type === 'LOCK') {
      await chrome.storage.session.remove(['vault', 'unlocked'])
      return { ok: true }
    }
    if (msg.type === 'UNLOCK') {
      const { blob } = await chrome.storage.local.get('blob')
      if (!blob) throw new Error('Belum ada brankas. Buka aplikasi Kunci dulu.')
      const vault = await decryptVault(blob, msg.password)
      await chrome.storage.session.set({ vault, unlocked: true })
      return { ok: true, count: vault.entries?.length ?? 0 }
    }
    if (msg.type === 'STATUS') {
      const vault = await getSession()
      const { blob } = await chrome.storage.local.get('blob')
      return { unlocked: Boolean(vault), hasBlob: Boolean(blob), count: vault?.entries?.length ?? 0 }
    }
    if (msg.type === 'MATCHES') {
      const vault = await getSession()
      if (!vault) return { locked: true, matches: [] }
      const matches = matchesForUrl(vault.entries, msg.url).map((e) => ({
        id: e.id,
        name: e.name,
        username: e.username || '',
        password: e.password || '',
        totpSecret: e.totpSecret || '',
      }))
      return { locked: false, matches }
    }
    if (msg.type === 'SEARCH') {
      const vault = await getSession()
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
