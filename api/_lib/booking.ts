// Logique de réservation partagée par les fonctions Vercel (api/*).
// Stripe est la seule source de vérité : les places prises = paiements Stripe Checkout
// réussis et non remboursés + paiements en cours (non expirés) pour la même date et le même atelier.
// Aucune base de données à maintenir.
// Deux formats : « presentiel » (une date, une place) et « online » (accès 12 mois, sans date).
import Stripe from 'stripe'
import { ONLINE_ACCESS_MONTHS, atelierById, hasOnline, lookupKey, priceOf, type Atelier, type FormatId } from '../../src/data/ateliers.js'
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

/** Paiement abouti : payé, ou gratuit grâce à une déduction (passage en présentiel) */
const isDone = (cs: Stripe.Checkout.Session) =>
  cs.status === 'complete' && (cs.payment_status === 'paid' || cs.payment_status === 'no_payment_required')

/**
 * Places prises par clé de stock (date + atelier), et paiements « en ligne » déjà convertis
 * en présentiel (une déduction ne s'utilise qu'une fois).
 */
export async function scanCheckouts(stripe: Stripe) {
  const taken = new Map<string, number>()
  const upgraded = new Set<string>()
  const list = stripe.checkout.sessions.list({
    created: { gte: SINCE },
    limit: 100,
    expand: ['data.payment_intent.latest_charge'],
  })
  for await (const cs of list) {
    const from = cs.metadata?.upgrade_from
    if (from && (cs.status === 'open' || isDone(cs))) upgraded.add(from)
    const key = cs.metadata?.slot
    if (!key) continue
    let counts = false
    if (cs.status === 'open') {
      counts = true
    } else if (isDone(cs)) {
      const pi = cs.payment_intent
      const charge = pi && typeof pi === 'object' ? pi.latest_charge : null
      const refunded = Boolean(charge && typeof charge === 'object' && charge.refunded)
      counts = !refunded
    }
    if (counts) taken.set(key, (taken.get(key) ?? 0) + 1)
  }
  return { taken, upgraded }
}

/** Nombre de places prises par clé de stock (date + atelier). */
export async function takenBySlot(stripe: Stripe): Promise<Map<string, number>> {
  return (await scanCheckouts(stripe)).taken
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

/**
 * Prix Stripe d'un couple atelier × format. Priorité à la variable d'environnement
 * (STRIPE_PRICE_<ATELIER> ou STRIPE_PRICE_<ATELIER>_ONLINE), sinon le prix portant l'étiquette
 * lookup_key « mjform_<atelier>_<format> » (créé par scripts/stripe-setup.mjs).
 * Le montant doit être exactement celui affiché sur le site.
 */
export async function resolvePrice(stripe: Stripe, atelier: Atelier, format: FormatId, env: Env = process.env) {
  const envName = priceEnvName(atelier.id) + (format === 'online' ? '_ONLINE' : '')
  let price: Stripe.Price | undefined
  if (env[envName]) price = await stripe.prices.retrieve(env[envName]!)
  else price = (await stripe.prices.list({ lookup_keys: [lookupKey(atelier.id, format)], active: true, limit: 1 })).data[0]
  if (!price) throw new BookingError('price-missing', 503)
  const expected = priceOf(atelier, format) * 100
  if (!price.active || price.currency !== 'eur' || price.unit_amount !== expected) {
    console.error(`Prix Stripe incohérent pour ${atelier.id}/${format} (${price.id}) : ${price.unit_amount} ${price.currency}, attendu ${expected}`)
    throw new BookingError('price-mismatch', 500)
  }
  return price
}

/** Paiement « en ligne » réutilisable pour passer en présentiel : montant à déduire. */
export async function upgradeCredit(stripe: Stripe, fromId: string, atelier: Atelier) {
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(fromId)) throw new BookingError('bad-request', 400)
  const from = await stripe.checkout.sessions.retrieve(fromId)
  if (!isDone(from) || from.metadata?.format !== 'online' || from.metadata?.atelier !== atelier.id) {
    throw new BookingError('upgrade-invalid', 400)
  }
  const { upgraded } = await scanCheckouts(stripe)
  if (upgraded.has(fromId)) throw new BookingError('upgrade-used', 409)
  const paid = (from.amount_total ?? 0) / 100
  const price = priceOf(atelier, 'presentiel')
  return { paid, price, credit: Math.min(paid, price), final: Math.max(0, price - paid), email: from.customer_details?.email ?? null }
}

export async function createCheckout(
  stripe: Stripe,
  input: { sessionId?: unknown; atelierId?: unknown; format?: unknown; upgradeFrom?: unknown },
  origin: string,
  env: Env = process.env,
) {
  const atelierId = typeof input.atelierId === 'string' ? input.atelierId : ''
  const format: FormatId = input.format === 'online' ? 'online' : 'presentiel'
  const atelier = atelierById(atelierId)
  if (!atelier) throw new BookingError('bad-request', 400)
  const common = {
    mode: 'payment' as const,
    locale: 'fr' as const,
    customer_creation: 'always' as const,
    phone_number_collection: { enabled: true },
    expires_at: Math.floor(Date.now() / 1000) + HOLD_SECONDS,
    success_url: `${origin}/merci/?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/#reserver`,
  }

  // ——— En ligne : accès 12 mois, pas de date ni de stock ———
  if (format === 'online') {
    if (!hasOnline(atelier)) throw new BookingError('bad-request', 400)
    const price = await resolvePrice(stripe, atelier, 'online', env)
    const label = `${atelier.name} · en ligne · accès ${ONLINE_ACCESS_MONTHS} mois`
    const metadata = { atelier: atelier.id, format: 'online' }
    const checkout = await stripe.checkout.sessions.create({
      ...common,
      line_items: [{ price: price.id, quantity: 1 }],
      metadata,
      payment_intent_data: { metadata, description: label },
      invoice_creation: { enabled: true, invoice_data: { description: label, footer: 'TVA non applicable, art. 293 B du CGI', metadata } },
      custom_text: { submit: { message: `${label}. Accès ouvert dès le paiement, dans votre espace stagiaire.` } },
    })
    if (!checkout.url) throw new BookingError('checkout-failed', 502)
    return { url: checkout.url }
  }

  // ——— En présentiel : une date, une place ———
  const sessionId = typeof input.sessionId === 'string' ? input.sessionId : ''
  const session = sessionById(sessionId)
  if (!session || !session.ateliers.includes(atelier.id)) throw new BookingError('bad-request', 400)
  if (new Date(session.start).getTime() <= Date.now()) throw new BookingError('session-past', 410)
  const price = await resolvePrice(stripe, atelier, 'presentiel', env)

  // Passage du format en ligne au présentiel : on déduit ce qui a déjà été payé (au minimum 0 €)
  const upgradeFrom = typeof input.upgradeFrom === 'string' && input.upgradeFrom ? input.upgradeFrom : null
  const credit = upgradeFrom ? await upgradeCredit(stripe, upgradeFrom, atelier) : null

  const key = slotKey(session.id, atelier.id)
  const taken = await takenBySlot(stripe)
  if ((taken.get(key) ?? 0) >= session.capacity) throw new BookingError('full', 409)

  const start = new Date(session.start)
  const when = `${formatDay(start)} · ${formatHours(session)}`
  const where = atelierAddress(env) ?? ADDRESS_FALLBACK
  const metadata: Record<string, string> = { slot: key, session: session.id, atelier: atelier.id, format: 'presentiel' }
  if (credit && upgradeFrom) {
    metadata.upgrade_from = upgradeFrom
    metadata.upgrade_credit = String(Math.round(credit.credit * 100))
  }
  // Déduction : coupon à usage unique du montant déjà payé
  const discounts =
    credit && credit.credit > 0
      ? [
          {
            coupon: (
              await stripe.coupons.create({
                amount_off: Math.round(credit.credit * 100),
                currency: 'eur',
                duration: 'once',
                max_redemptions: 1,
                name: 'Déjà payé (format en ligne)',
                metadata: { upgrade_from: upgradeFrom! },
              })
            ).id,
          },
        ]
      : undefined

  const checkout = await stripe.checkout.sessions.create({
    ...common,
    line_items: [{ price: price.id, quantity: 1 }],
    discounts,
    ...(credit?.email ? { customer_email: credit.email } : {}),
    metadata,
    payment_intent_data: credit && credit.final === 0 ? undefined : { metadata, description: `${atelier.name} · ${when}` },
    invoice_creation: {
      enabled: true,
      invoice_data: {
        description: `${atelier.name} · en présentiel · ${when} · ${where}`,
        footer: 'TVA non applicable, art. 293 B du CGI',
        metadata,
      },
    },
    custom_text: {
      submit: { message: `${atelier.name} · ${when} · ${where}` },
    },
  })
  if (!checkout.url) throw new BookingError('checkout-failed', 502)
  return { url: checkout.url }
}

/** Récapitulatif affiché sur /merci après paiement. */
export async function bookingSummary(stripe: Stripe, id: string, env: Env = process.env) {
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) throw new BookingError('bad-request', 400)
  const cs = await stripe.checkout.sessions.retrieve(id)
  if (!isDone(cs)) throw new BookingError('not-paid', 404)
  const atelier = atelierById(cs.metadata?.atelier ?? '')
  if (!atelier) throw new BookingError('not-found', 404)
  const base = {
    atelier: atelier.name,
    duration: atelier.duration,
    amount: (cs.amount_total ?? 0) / 100,
    pack: Boolean(atelier.pack),
    email: cs.customer_details?.email ?? null,
  }
  if (cs.metadata?.format === 'online') {
    const until = new Date(cs.created * 1000)
    until.setMonth(until.getMonth() + ONLINE_ACCESS_MONTHS)
    return { ...base, format: 'online' as const, accessUntil: until.toISOString() }
  }
  const session = sessionById(cs.metadata?.session ?? '')
  if (!session) throw new BookingError('not-found', 404)
  return {
    ...base,
    format: 'presentiel' as const,
    date: formatDay(new Date(session.start)),
    hours: formatHours(session),
    /** null : l'adresse n'est pas encore communiquée (texte de repli affiché) */
    address: atelierAddress(env),
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
