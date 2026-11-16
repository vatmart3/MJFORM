// Logique de réservation partagée par les fonctions Vercel (api/*).
// Stripe est la seule source de vérité : les places prises = paiements Stripe Checkout
// réussis et non remboursés + paiements en cours (non expirés) pour la même date et le même atelier.
// Aucune base de données à maintenir.
import Stripe from 'stripe'
import { atelierById } from '../../src/data/ateliers.js'
import {
  ADDRESS_FALLBACK,
  formatDay,
  formatHours,
  priceEnvName,
  sessionById,
  slotKey,
  upcomingSessions,
} from '../../src/data/sessions.js'

/** On ne compte que les paiements créés après l'ouverture des réservations. */
const SINCE = Math.floor(new Date('2026-11-01T00:00:00Z').getTime() / 1000)
/** Durée de vie d'un paiement Stripe Checkout (minimum autorisé par Stripe) : la place est retenue pendant ce temps. */
const HOLD_SECONDS = 30 * 60 + 30

type Env = Record<string, string | undefined>

/** Adresse de l'atelier : variable d'environnement ADRESSE_ATELIER, ou null si elle est vide. */
export const atelierAddress = (env: Env = process.env) => env.ADRESSE_ATELIER?.trim() || null

export class BookingError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code)
  }
}

export function getStripe(env: Env = process.env): Stripe {
  const key = env.STRIPE_SECRET_KEY
  if (!key) throw new BookingError('not-configured', 503)
  return new Stripe(key)
}

/** Nombre de places prises par clé de stock (date + atelier). */
export async function takenBySlot(stripe: Stripe): Promise<Map<string, number>> {
  const taken = new Map<string, number>()
  const list = stripe.checkout.sessions.list({
    created: { gte: SINCE },
    limit: 100,
    expand: ['data.payment_intent.latest_charge'],
  })
  for await (const cs of list) {
    const key = cs.metadata?.slot
    if (!key) continue
    let counts = false
    if (cs.status === 'open') {
      counts = true
    } else if (cs.status === 'complete' && cs.payment_status === 'paid') {
      const pi = cs.payment_intent
      const charge = pi && typeof pi === 'object' ? pi.latest_charge : null
      const refunded = Boolean(charge && typeof charge === 'object' && charge.refunded)
      counts = !refunded
    }
    if (counts) taken.set(key, (taken.get(key) ?? 0) + 1)
  }
  return taken
}

/** Places restantes pour chaque date à venir et chaque atelier proposé ce jour-là. */
export async function availability(stripe: Stripe) {
  const taken = await takenBySlot(stripe)
  const slots: Record<string, number> = {}
  for (const s of upcomingSessions()) {
    for (const a of s.ateliers) {
      const key = slotKey(s.id, a)
      slots[key] = Math.max(0, s.capacity - (taken.get(key) ?? 0))
    }
  }
  return slots
}

export async function createCheckout(
  stripe: Stripe,
  input: { sessionId?: unknown; atelierId?: unknown },
  origin: string,
  env: Env = process.env,
) {
  const sessionId = typeof input.sessionId === 'string' ? input.sessionId : ''
  const atelierId = typeof input.atelierId === 'string' ? input.atelierId : ''
  const session = sessionById(sessionId)
  const atelier = atelierById(atelierId)
  if (!session || !atelier || !session.ateliers.includes(atelier.id)) throw new BookingError('bad-request', 400)
  if (new Date(session.start).getTime() <= Date.now()) throw new BookingError('session-past', 410)

  // Produit Stripe lu dans les variables d'environnement, et vérifié : le montant encaissé
  // doit être exactement celui affiché sur le site.
  const priceId = env[priceEnvName(atelier.id)]
  if (!priceId) throw new BookingError('price-missing', 503)
  const price = await stripe.prices.retrieve(priceId)
  if (!price.active || price.currency !== 'eur' || price.unit_amount !== atelier.price * 100) {
    console.error(`Prix Stripe incohérent pour ${atelier.id} (${priceId}) : ${price.unit_amount} ${price.currency}`)
    throw new BookingError('price-mismatch', 500)
  }

  const key = slotKey(session.id, atelier.id)
  const taken = await takenBySlot(stripe)
  if ((taken.get(key) ?? 0) >= session.capacity) throw new BookingError('full', 409)

  const start = new Date(session.start)
  const when = `${formatDay(start)} · ${formatHours(session)}`
  const where = atelierAddress(env) ?? ADDRESS_FALLBACK
  const metadata = { slot: key, session: session.id, atelier: atelier.id }

  const checkout = await stripe.checkout.sessions.create({
    mode: 'payment',
    locale: 'fr',
    line_items: [{ price: priceId, quantity: 1 }],
    metadata,
    payment_intent_data: { metadata, description: `${atelier.name} · ${when}` },
    customer_creation: 'always',
    phone_number_collection: { enabled: true },
    invoice_creation: {
      enabled: true,
      invoice_data: {
        description: `${atelier.name} · ${when} · ${where}`,
        footer: 'TVA non applicable, art. 293 B du CGI',
        metadata,
      },
    },
    custom_text: {
      submit: { message: `${atelier.name} · ${when} · ${where}` },
    },
    expires_at: Math.floor(Date.now() / 1000) + HOLD_SECONDS,
    success_url: `${origin}/merci/?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/#reserver`,
  })
  if (!checkout.url) throw new BookingError('checkout-failed', 502)
  return { url: checkout.url }
}

/** Récapitulatif affiché sur /merci après paiement. */
export async function bookingSummary(stripe: Stripe, id: string, env: Env = process.env) {
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) throw new BookingError('bad-request', 400)
  const cs = await stripe.checkout.sessions.retrieve(id)
  if (cs.status !== 'complete' || cs.payment_status !== 'paid') throw new BookingError('not-paid', 404)
  const session = sessionById(cs.metadata?.session ?? '')
  const atelier = atelierById(cs.metadata?.atelier ?? '')
  if (!session || !atelier) throw new BookingError('not-found', 404)
  return {
    atelier: atelier.name,
    duration: atelier.duration,
    date: formatDay(new Date(session.start)),
    hours: formatHours(session),
    /** null : l'adresse n'est pas encore communiquée (texte de repli affiché) */
    address: atelierAddress(env),
    amount: (cs.amount_total ?? 0) / 100,
    pack: Boolean(atelier.pack),
  }
}

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  })

export function errorResponse(e: unknown) {
  if (e instanceof BookingError) return json({ error: e.code }, e.status, { 'Cache-Control': 'no-store' })
  console.error(e)
  return json({ error: 'server-error' }, 500, { 'Cache-Control': 'no-store' })
}
