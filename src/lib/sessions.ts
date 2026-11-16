import { useEffect, useState } from 'react'
import { atelierById } from '../data/ateliers'
import { SESSIONS, slotKey, upcomingSessions, type Session } from '../data/sessions'

export { formatDay, formatHours, formatTime } from '../data/sessions'

export interface SessionSlot {
  session: Session
  id: string
  startsAt: Date
  capacity: number
  /** Places réellement restantes (lues dans Stripe). null = inconnu : rien n'est affiché. */
  seatsLeft: number | null
}

type Availability = Record<string, number>

let cache: Promise<Availability | null> | null = null

async function fetchAvailability(): Promise<Availability | null> {
  try {
    const r = await fetch('/api/availability', { headers: { Accept: 'application/json' } })
    if (!r.ok) return null
    const data = (await r.json()) as { slots?: Availability }
    return data.slots ?? null
  } catch {
    return null
  }
}

/** Places restantes par date et atelier. null si l'information n'est pas disponible. */
export function useAvailability() {
  const [state, setState] = useState<{ availability: Availability | null; loading: boolean }>({
    availability: null,
    loading: true,
  })
  useEffect(() => {
    let alive = true
    cache ??= fetchAvailability()
    cache.then((availability) => {
      if (alive) setState({ availability, loading: false })
      if (!availability) cache = null
    })
    return () => {
      alive = false
    }
  }, [])
  return state
}

/** Dates à venir où l'atelier est proposé, avec ses places restantes. */
export function slotsFor(atelierId: string, availability: Availability | null): SessionSlot[] {
  if (!atelierById(atelierId)) return []
  return upcomingSessions()
    .filter((s) => s.ateliers.includes(atelierId))
    .map((s) => ({
      session: s,
      id: s.id,
      startsAt: new Date(s.start),
      capacity: s.capacity,
      seatsLeft: availability ? (availability[slotKey(s.id, atelierId)] ?? null) : null,
    }))
}

export const hasSession = (id: string) => SESSIONS.some((s) => s.id === id)

export async function startCheckout(input: {
  atelierId: string
  format: 'presentiel' | 'online'
  sessionId?: string
  /** Paiement « en ligne » à déduire (passage au présentiel) */
  upgradeFrom?: string
}): Promise<string> {
  const r = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await r.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!r.ok || !data.url) throw new Error(data.error || 'checkout-failed')
  return data.url
}

export interface UpgradeQuote {
  atelierId: string
  paid: number
  price: number
  final: number
}

/** Prix du présentiel après déduction d'un achat « en ligne » (lien depuis l'espace stagiaire). */
export async function fetchUpgradeQuote(from: string, atelierId: string): Promise<UpgradeQuote> {
  const r = await fetch(`/api/upgrade-quote?from=${encodeURIComponent(from)}&atelier=${encodeURIComponent(atelierId)}`)
  const data = (await r.json().catch(() => ({}))) as UpgradeQuote & { error?: string }
  if (!r.ok) throw new Error(data.error || 'upgrade-failed')
  return data
}
