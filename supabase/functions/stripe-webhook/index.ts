// Webhook Stripe : confirme ou libère la place retenue.
// À déployer sans vérification JWT : supabase functions deploy stripe-webhook --no-verify-jwt
import Stripe from 'npm:stripe@17'
import { createClient } from 'npm:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { httpClient: Stripe.createFetchHttpClient() })
const cryptoProvider = Stripe.createSubtleCryptoProvider()
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

Deno.serve(async (req) => {
  const signature = req.headers.get('Stripe-Signature')
  const payload = await req.text()
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      payload,
      signature!,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
      undefined,
      cryptoProvider,
    )
  } catch (e) {
    console.error('signature', e)
    return new Response('invalid signature', { status: 400 })
  }

  const s = event.data.object as Stripe.Checkout.Session
  const bookingId = s.metadata?.booking_id ?? s.client_reference_id

  if (!bookingId) return new Response('ignored', { status: 200 })

  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      if (s.payment_status !== 'paid') break
      await db
        .from('bookings')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          hold_until: null,
          customer_email: s.customer_details?.email ?? null,
          customer_name: s.customer_details?.name ?? null,
          customer_phone: s.customer_details?.phone ?? null,
        })
        .eq('id', bookingId)
      break
    }
    case 'checkout.session.expired':
    case 'checkout.session.async_payment_failed': {
      await db.from('bookings').update({ status: 'expired', hold_until: null }).eq('id', bookingId).eq('status', 'pending')
      break
    }
  }
  return new Response('ok', { status: 200 })
})
