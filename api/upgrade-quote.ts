// GET /api/upgrade-quote?from=cs_…&atelier=… → prix du présentiel après déduction du format en ligne déjà payé
import { BookingError, errorResponse, getStripe, json, upgradeCredit } from './_lib/booking.js'
import { atelierById } from '../src/data/ateliers.js'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const atelier = atelierById(url.searchParams.get('atelier') ?? '')
    if (!atelier) throw new BookingError('bad-request', 400)
    const q = await upgradeCredit(getStripe(), url.searchParams.get('from') ?? '', atelier)
    return json({ atelierId: atelier.id, paid: q.paid, price: q.price, final: q.final }, 200, { 'Cache-Control': 'private, no-store' })
  } catch (e) {
    return errorResponse(e)
  }
}
