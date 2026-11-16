// Toasts discrets, annoncés aux lecteurs d'écran.
import { AnimatePresence, motion } from 'motion/react'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

type Toast = { id: number; text: string; kind: 'ok' | 'error' }
const Ctx = createContext<(text: string, kind?: Toast['kind']) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const push = useCallback((text: string, kind: Toast['kind'] = 'ok') => {
    const id = Date.now() + Math.random()
    setItems((l) => [...l.slice(-2), { id, text, kind }])
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 3600)
  }, [])
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              className={`toast${t.kind === 'error' ? ' error' : ''}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
              transition={{ duration: 0.25 }}
            >
              {t.kind === 'error' ? <AlertCircle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
