// Crée une session Stripe Checkout pour une place d'atelier.
// Le prix est TOUJOURS calculé ici, côté serveur, depuis la base (jamais depuis le navigateur).
import Stripe from 'npm:stripe@17'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { httpClient: Stripe.createFetchHttpClient() })
const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://mjform.fr').replace(/\/$/, '')

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

const fmt = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris',
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  let body: { sessionId?: string; atelierId?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad-request' }, 400)
  }
  const { sessionId, atelierId } = body
  if (!sessionId || !atelierId) return json({ error: 'bad-request' }, 400)

  const { data: session } = await db
    .from('sessions')
    .select('id, starts_at, price_override_cents, published, atelier:ateliers(id, level, name)')
    .eq('id', sessionId)
    .maybeSingle()
  const { data: chosen } = await db.from('ateliers').select('id, level, name, price_cents, is_pack').eq('id', atelierId).maybeSingle()

  if (!session || !session.published || !chosen) return json({ error: 'session-unavailable' }, 404)
  const sessionAtelier = session.atelier as unknown as { id: string; level: string; name: string }
  const compatible = chosen.id === sessionAtelier.id || (chosen.is_pack && chosen.level === sessionAtelier.level)
  if (!compatible) return json({ error: 'bad-request' }, 400)

  const amount =
    !chosen.is_pack && session.price_override_cents ? session.price_override_cents : chosen.price_cents

  // Retient une place de façon atomique (refus si complet)
  const { data: bookingId, error: holdError } = await db.rpc('hold_seat', {
    p_session_id: session.id,
    p_atelier_id: chosen.id,
    p_amount_cents: amount,
  })
  if (holdError) {
    const full = holdError.message.includes('full')
    return json({ error: full ? 'full' : 'session-unavailable' }, full ? 409 : 404)
  }

  const when = fmt.format(new Date(session.starts_at))
  try {
    const checkout = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'fr',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: amount,
            product_data: {
              name: `MJ FORM · ${chosen.name}`,
              description: chosen.is_pack
                ? `Premier atelier : ${sessionAtelier.name}, ${when}, Sète`
                : `${when}, Sète`,
            },
          },
        },
      ],
      customer_creation: 'always',
      phone_number_collection: { enabled: true },
      invoice_creation: { enabled: true },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      client_reference_id: bookingId as string,
      metadata: { booking_id: bookingId as string, session_id: session.id, atelier_id: chosen.id },
      success_url: `${SITE_URL}/merci/?reservation={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/#reserver`,
    })
    await db.from('bookings').update({ stripe_checkout_id: checkout.id }).eq('id', bookingId)
    return json({ url: checkout.url })
  } catch (e) {
    console.error('stripe', e)
    await db.from('bookings').update({ status: 'expired', hold_until: null }).eq('id', bookingId)
    return json({ error: 'checkout-failed' }, 502)
  }
})
