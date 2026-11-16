// POST /api/espace/checkout { formationId } → { url } (Stripe Checkout, ou /espace/merci si rien à payer)
import { createFormationCheckout } from '../_lib/espace-checkout.js'
import { errorResponse, getServiceClient, getStripe, originOf, requireUser, send } from '../_lib/espace.js'

export async function POST(request: Request) {
  try {
    const db = getServiceClient()
    const user = await requireUser(request, db)
    const body = (await request.json().catch(() => ({}))) as { formationId?: unknown }
    const result = await createFormationCheckout({ db, stripe: () => getStripe() }, user, body.formationId, originOf(request))
    return send(result)
  } catch (e) {
    return errorResponse(e)
  }
}
