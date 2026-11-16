// POST /api/stripe-webhook : événements Stripe signés (STRIPE_WEBHOOK_SECRET).
// Événements à activer : checkout.session.completed, checkout.session.async_payment_succeeded.
import type Stripe from 'stripe'
import { handleStripeEvent } from './_lib/espace-webhook.js'
import { getServiceClient, getStripe, json } from './_lib/espace.js'

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return json({ error: 'not-configured' }, 503)
  let stripe: Stripe
  try {
    stripe = getStripe()
  } catch {
    return json({ error: 'not-configured' }, 503)
  }

  // Corps brut indispensable à la vérification de la signature
  const payload = await request.text()
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(payload, request.headers.get('stripe-signature') ?? '', secret)
  } catch {
    return json({ error: 'bad-signature' }, 400)
  }

  try {
    const result = await handleStripeEvent(event, { db: getServiceClient(), stripe: () => stripe })
    return json({ received: true, result })
  } catch (e) {
    // 500 : Stripe renverra l'événement plus tard
    console.error(`Webhook Stripe ${event.id} (${event.type}) en échec`, e)
    return json({ error: 'server-error' }, 500)
  }
}
