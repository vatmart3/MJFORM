// POST /api/checkout { sessionId, atelierId } → { url } (page de paiement Stripe Checkout)
import { createCheckout, errorResponse, getStripe, json } from './_lib/booking.js'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const origin = new URL(request.url).origin
    const result = await createCheckout(getStripe(), body, origin)
    return json(result, 200, { 'Cache-Control': 'no-store' })
  } catch (e) {
    return errorResponse(e)
  }
}
