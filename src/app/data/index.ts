// Choix du backend : Supabase si configuré, sinon l'espace de test (mode démo).
// VITE_ESPACE_DEMO=1 force le mode démo même avec Supabase configuré.
import type { Backend } from './backend'
import { demoBackend } from './demo'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const forceDemo = import.meta.env.VITE_ESPACE_DEMO === '1'

export const supabaseConfigured = Boolean(url && key) && !forceDemo

/** Production sans Supabase : l'espace n'est pas encore ouvert (pas d'espace de test public). */
export const espaceOpen = supabaseConfigured || __ESPACE_DEMO__ || forceDemo

let instance: Backend | null = supabaseConfigured ? null : demoBackend
let pending: Promise<Backend> | null = null

/** Backend actif (le client Supabase n'est chargé que s'il est utilisé). */
export function getBackend(): Promise<Backend> {
  if (instance) return Promise.resolve(instance)
  pending ??= import('./supabase').then((m) => (instance = m.createSupabaseBackend(url!, key!)))
  return pending
}
