// GET /api/availability → { slots: { "<date>:<atelier>": places restantes } }
import { BookingError, availability, errorResponse, getStripe, json } from './_lib/booking.js'

let cache: { at: number; slots: Record<string, number> } | null = null

export async function GET() {
  try {
    if (!cache || Date.now() - cache.at > 15_000) {
      cache = { at: Date.now(), slots: await availability(getStripe()) }
    }
    return json({ slots: cache.slots }, 200, { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=20' })
  } catch (e) {
    // Stripe pas encore configuré : pas d'erreur, simplement aucune information de places.
    if (e instanceof BookingError && e.code === 'not-configured') return json({ slots: null }, 200, { 'Cache-Control': 'no-store' })
    return errorResponse(e)
  }
}
