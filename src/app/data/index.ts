// Choix du backend.
// Pour l'instant, l'espace de test (mode démo, comptes fictifs) est utilisé partout, même en production,
// pour pouvoir découvrir l'espace stagiaire. VITE_ESPACE_DEMO=0 active la vraie version (Supabase).
import type { Backend } from './backend'
import { demoBackend } from './demo'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const forceDemo = import.meta.env.VITE_ESPACE_DEMO !== '0'

export const supabaseConfigured = Boolean(url && key) && !forceDemo

/** Vraie version sans Supabase en production : l'espace n'est pas encore ouvert. */
export const espaceOpen = supabaseConfigured || __ESPACE_DEMO__ || forceDemo

let instance: Backend | null = supabaseConfigured ? null : demoBackend
let pending: Promise<Backend> | null = null

/** Backend actif (le client Supabase n'est chargé que s'il est utilisé). */
export function getBackend(): Promise<Backend> {
  if (instance) return Promise.resolve(instance)
  pending ??= import('./supabase').then((m) => (instance = m.createSupabaseBackend(url!, key!)))
  return pending
}
