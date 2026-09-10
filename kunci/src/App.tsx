import { useEffect, useState } from 'react'
import { ToastProvider } from './components/Toast'
import { RecoveryKeyModal } from './components/RecoveryKeyModal'
import { VaultProvider, useVault } from './state/VaultContext'
import { LockScreen, SetupScreen } from './views/Gate'
import { AppShell } from './views/AppShell'
import { IconKey } from './components/Icons'
import { applyPlatformAttr } from './lib/platform'

function BootScreen({ message }: { message: string }) {
  return (
    <div className="gate">
      <div className="boot-card">
        <span className="brand-mark">
          <IconKey size={28} />
        </span>
        <p className="muted">{message}</p>
      </div>
    </div>
  )
}

function ThemedApp() {
  const { status, vault, pendingRecoveryKey, dismissRecoveryKey } = useVault()
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)

  useEffect(() => {
    applyPlatformAttr()
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

  if (status === 'loading') return <BootScreen message="Membuka brankas…" />
  return (
    <>
      {status === 'setup' ? <SetupScreen /> : null}
      {status === 'locked' ? <LockScreen /> : null}
      {status === 'unlocked' ? <AppShell /> : null}
      {pendingRecoveryKey ? <RecoveryKeyModal recoveryKey={pendingRecoveryKey} onDone={dismissRecoveryKey} /> : null}
    </>
  )
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
