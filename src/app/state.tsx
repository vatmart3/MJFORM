// Session et données du client, partagées par toutes les pages.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Backend } from './data/backend'
import { getBackend } from './data'
import type { Enrollment, Formation, LessonProgress, Profile, Referral, Reward, Settings } from './data/types'

interface Session {
  backend: Backend | null
  user: Profile | null
  /** Session en cours de chargement */
  loading: boolean
}
const SessionCtx = createContext<Session>({ backend: null, user: null, loading: true })

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Session>({ backend: null, user: null, loading: true })
  useEffect(() => {
    let off = () => {}
    let alive = true
    getBackend().then(async (backend) => {
      const user = await backend.currentUser().catch(() => null)
      if (!alive) return
      setState({ backend, user, loading: false })
      off = backend.onAuthChange((u) => setState((s) => ({ ...s, user: u })))
    })
    return () => {
      alive = false
      off()
    }
  }, [])
  return <SessionCtx.Provider value={state}>{children}</SessionCtx.Provider>
}

export const useSession = () => useContext(SessionCtx)

export function useBackend(): Backend {
  const { backend } = useSession()
  if (!backend) throw new Error('backend-not-ready')
  return backend
}

/** Données du client connecté : formations, accès, progression, récompenses, parrainage. */
export interface ClientData {
  formations: Formation[]
  enrollments: Enrollment[]
  progress: LessonProgress[]
  rewards: Reward[]
  referrals: Referral[]
  settings: Settings
  learners: Record<string, number>
}

interface DataState {
  data: ClientData | null
  error: string | null
  refresh: () => Promise<void>
  /** Mise à jour locale immédiate (optimiste), avant confirmation du serveur */
  patch: (fn: (d: ClientData) => ClientData) => void
}
const DataCtx = createContext<DataState>({ data: null, error: null, refresh: async () => {}, patch: () => {} })

export function ClientDataProvider({ children }: { children: ReactNode }) {
  const backend = useBackend()
  const { user } = useSession()
  const [data, setData] = useState<ClientData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [formations, enrollments, progress, rewards, referrals, settings, learners] = await Promise.all([
        backend.listFormations(),
        backend.listEnrollments(),
        backend.listProgress(),
        backend.listRewards(),
        backend.listReferrals(),
        backend.getSettings(),
        backend.learnersCount(),
      ])
      setData({ formations, enrollments, progress, rewards, referrals, settings, learners })
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [backend])

  useEffect(() => {
    if (user) refresh()
  }, [user?.id, refresh]) // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo(
    () => ({ data, error, refresh, patch: (fn: (d: ClientData) => ClientData) => setData((d) => (d ? fn(d) : d)) }),
    [data, error, refresh],
  )
  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>
}

export const useClientData = () => useContext(DataCtx)
