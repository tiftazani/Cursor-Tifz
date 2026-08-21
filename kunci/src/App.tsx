import { useEffect, useState, type ReactNode } from 'react'
import { ToastProvider } from './components/Toast'
import { ApiMissingScreen, AuthGate } from './components/AuthGate'
import { RecoveryKeyModal } from './components/RecoveryKeyModal'
import { VaultProvider, useVault } from './state/VaultContext'
import { LockScreen, SetupScreen } from './views/Gate'
import { AppShell } from './views/AppShell'
import { isPublicHost, sessionStatus } from './lib/cloud'

function CloudSessionGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'load' | 'auth' | 'ok' | 'missing'>('load')

  useEffect(() => {
    void sessionStatus().then((s) => {
      if (s.signedIn) setState('ok')
      else if (!s.configured) setState('missing')
      else setState('auth')
    })
  }, [])

  if (state === 'load') {
    return (
      <div className="gate">
        <div className="muted">Memeriksa sesi cloud…</div>
      </div>
    )
  }
  if (state === 'missing') {
    if (!isPublicHost()) return <AuthGate onAuthed={() => setState('ok')} />
    return <ApiMissingScreen />
  }
  if (state === 'auth') return <AuthGate onAuthed={() => setState('ok')} />
  return children
}

function ThemedApp() {
  const {
    status,
    vault,
    pendingRecoveryKey,
    dismissRecoveryKey,
    emailPendingRecoveryKey,
  } = useVault()
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
  return (
    <>
      {status === 'setup' ? <SetupScreen /> : null}
      {status === 'locked' ? <LockScreen /> : null}
      {status === 'unlocked' ? <AppShell /> : null}
      {pendingRecoveryKey ? (
        <RecoveryKeyModal
          recoveryKey={pendingRecoveryKey}
          onDone={dismissRecoveryKey}
          onEmail={emailPendingRecoveryKey}
        />
      ) : null}
    </>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <CloudSessionGate>
        <VaultProvider>
          <ThemedApp />
        </VaultProvider>
      </CloudSessionGate>
    </ToastProvider>
  )
}
