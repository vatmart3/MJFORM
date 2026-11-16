// GET /api/session?id=cs_... → récapitulatif de la réservation payée (page /merci)
import { bookingSummary, errorResponse, getStripe, json } from './_lib/booking.js'

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('id') ?? ''
    return json(await bookingSummary(getStripe(), id), 200, { 'Cache-Control': 'private, no-store' })
  } catch (e) {
    return errorResponse(e)
  }
}
