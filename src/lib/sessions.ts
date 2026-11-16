import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { atelierById } from '../data/ateliers'

export interface SessionSlot {
  id: string
  atelierId: string
  startsAt: Date
  capacity: number
  /** Places réellement restantes (null = inconnu : rien n'est affiché) */
  seatsLeft: number | null
  /** Prix spécial de la session (ex. session de lancement), en euros */
  priceOverride: number | null
  /** true quand la donnée vient de Supabase et que le paiement est possible */
  bookable: boolean
}

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabaseConfigured = Boolean(url && anon)

let client: SupabaseClient | null = null
async function getClient() {
  if (!supabaseConfigured) return null
  if (!client) {
    const { createClient } = await import('@supabase/supabase-js')
    client = createClient(url!, anon!, { auth: { persistSession: false } })
  }
  return client
}

interface AvailabilityRow {
  session_id: string
  atelier_id: string
  starts_at: string
  capacity: number
  seats_left: number
  price_override_cents: number | null
}

async function fetchSessions(): Promise<SessionSlot[]> {
  const sb = await getClient()
  if (!sb) return upcomingSlotsWithoutData()
  const { data, error } = await sb.rpc('session_availability')
  if (error) throw error
  return (data as AvailabilityRow[]).map((r) => ({
    id: r.session_id,
    atelierId: r.atelier_id,
    startsAt: new Date(r.starts_at),
    capacity: r.capacity,
    seatsLeft: Math.max(0, r.seats_left),
    priceOverride: r.price_override_cents == null ? null : r.price_override_cents / 100,
    bookable: true,
  }))
}

/**
 * Sans base de données configurée : on propose les prochains créneaux habituels
 * (vendredi 18 h 30, lundi 19 h) SANS nombre de places, et la réservation passe par un message.
 * Aucune rareté n'est jamais simulée.
 */
/** Date correspondant à une heure « murale » de Paris, quel que soit le fuseau de l'appareil. */
function parisDate(y: number, m: number, d: number, h: number, min: number) {
  const guess = Date.UTC(y, m, d, h, min)
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(guess))
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'))
  return new Date(guess - (asUtc - guess))
}

function upcomingSlotsWithoutData(): SessionSlot[] {
  const out: SessionSlot[] = []
  const now = new Date()
  for (let d = 1; d <= 21 && out.length < 4; d++) {
    const ref = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d)
    const dow = ref.getDay()
    if (dow !== 5 && dow !== 1) continue
    const day = parisDate(ref.getFullYear(), ref.getMonth(), ref.getDate(), dow === 5 ? 18 : 19, dow === 5 ? 30 : 0)
    out.push({
      id: `slot-${day.toISOString()}`,
      atelierId: '*',
      startsAt: day,
      capacity: 8,
      seatsLeft: null,
      priceOverride: null,
      bookable: false,
    })
  }
  return out
}

let cache: Promise<SessionSlot[]> | null = null

export function useSessions() {
  const [state, setState] = useState<{ slots: SessionSlot[]; loading: boolean; error: boolean }>({
    slots: [],
    loading: true,
    error: false,
  })
  useEffect(() => {
    let alive = true
    cache ??= fetchSessions()
    cache
      .then((slots) => alive && setState({ slots, loading: false, error: false }))
      .catch(() => {
        cache = null
        if (alive) setState({ slots: [], loading: false, error: true })
      })
    return () => {
      alive = false
    }
  }, [])
  return state
}

/** Créneaux pertinents pour un atelier (un pack accepte tous les ateliers de son niveau). */
export function slotsFor(slots: SessionSlot[], atelierId: string) {
  const a = atelierById(atelierId)
  if (!a) return []
  return slots
    .filter((s) => {
      if (s.atelierId === '*') return true
      if (a.pack) return atelierById(s.atelierId)?.level === a.level
      return s.atelierId === a.id
    })
    .sort((x, y) => x.startsAt.getTime() - y.startsAt.getTime())
}

export async function startCheckout(sessionId: string, atelierId: string): Promise<string> {
  const sb = await getClient()
  if (!sb) throw new Error('not-configured')
  const { data, error } = await sb.functions.invoke('create-checkout', { body: { sessionId, atelierId } })
  if (error) {
    // Le message métier (« complet », etc.) est renvoyé dans le corps de la réponse
    const ctx = (error as { context?: Response }).context
    const body = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null
    throw new Error(body?.error || 'checkout-failed')
  }
  return (data as { url: string }).url
}

const fmtDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })
const fmtTime = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

export const formatDay = (d: Date) => {
  const s = fmtDay.format(d)
  return s.charAt(0).toUpperCase() + s.slice(1)
}
export const formatTime = (d: Date) => fmtTime.format(d).replace(':', ' h ').replace(' h 00', ' h')
