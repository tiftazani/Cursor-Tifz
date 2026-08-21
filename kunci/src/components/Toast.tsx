import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { newId } from '../lib/id'

export type ToastTone = 'ok' | 'warn' | 'danger'

interface ToastItem {
  id: string
  message: string
  tone: ToastTone
}

interface ToastApi {
  push: (message: string, tone?: ToastTone) => void
}

const Ctx = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const push = useCallback((message: string, tone: ToastTone = 'ok') => {
    const id = newId()
    setItems((prev) => [...prev.slice(-3), { id, message, tone }])
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id))
    }, 4200)
  }, [])

  const api = useMemo(() => ({ push }), [push])

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast outside provider')
  return ctx
}
