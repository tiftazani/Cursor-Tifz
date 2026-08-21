import { useEffect, useState } from 'react'
import { ToastProvider } from './components/Toast'
import { VaultProvider, useVault } from './state/VaultContext'
import { LockScreen, SetupScreen } from './views/Gate'
import { AppShell } from './views/AppShell'

function ThemedApp() {
  const { status, vault } = useVault()
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => setSystemDark(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  const pref = vault?.settings.theme ?? 'dark'
  const theme = pref === 'system' ? (systemDark ? 'dark' : 'light') : pref

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  if (status === 'loading') {
    return (
      <div className="gate">
        <div className="muted">Membuka Kunci…</div>
      </div>
    )
  }
  if (status === 'setup') return <SetupScreen />
  if (status === 'locked') return <LockScreen />
  return <AppShell />
}

export default function App() {
  return (
    <ToastProvider>
      <VaultProvider>
        <ThemedApp />
      </VaultProvider>
    </ToastProvider>
  )
}
