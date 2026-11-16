// Outils partagés des fonctions de l'espace client (api/espace/*, api/stripe-webhook).
// Le client Supabase « service_role » contourne le RLS : il ne sert qu'après vérification
// de l'utilisateur (jeton Supabase) ou de la signature Stripe.
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { BookingError, errorResponse, getStripe, json } from './booking.js'

export { BookingError as EspaceError, errorResponse, getStripe, json }

type Env = Record<string, string | undefined>

let service: SupabaseClient | null = null

export function getServiceClient(env: Env = process.env): SupabaseClient {
  if (service) return service
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new BookingError('not-configured', 503)
  service = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  return service
}

/** Utilisateur connecté, d'après l'en-tête Authorization: Bearer <jeton Supabase>. */
export async function requireUser(request: Request, db: SupabaseClient = getServiceClient()): Promise<User> {
  const token = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') ?? '')?.[1]
  if (!token) throw new BookingError('not-authenticated', 401)
  const { data, error } = await db.auth.getUser(token)
  if (error || !data.user) throw new BookingError('not-authenticated', 401)
  return data.user
}

export async function isAdmin(db: SupabaseClient, userId: string) {
  const { data, error } = await db.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle()
  if (error) throw error
  return Boolean(data)
}

export async function requireAdmin(request: Request, db: SupabaseClient = getServiceClient()): Promise<User> {
  const user = await requireUser(request, db)
  if (!(await isAdmin(db, user.id))) throw new BookingError('forbidden', 403)
  return user
}

/** Réponse JSON jamais mise en cache (données personnelles). */
export const send = (body: unknown, status = 200) => json(body, status, { 'Cache-Control': 'private, no-store' })

/** Lève l'erreur d'une requête Supabase (→ 500, journalisée). */
export function check<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error
  return res.data
}

export const originOf = (request: Request) => new URL(request.url).origin
export const espaceUrl = (origin: string) => `${origin}/espace/`
