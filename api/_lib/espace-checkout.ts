// Paiement d'une formation en ligne : le prix est recalculé ici avec quote() (mêmes règles
// que l'affichage), à partir du prix enregistré en base. Réduction appliquée par un coupon
// Stripe à usage unique : récompense de parrainage, ou avantage filleul (première formation).
import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import { DEFAULT_SETTINGS, quote, type PriceQuote } from '../../src/app/data/logic.js'
import type { Reward, RewardTier, Settings } from '../../src/app/data/types.js'
import { EspaceError, check } from './espace.js'

export type StripeLike = {
  coupons: Pick<Stripe['coupons'], 'create' | 'retrieve'>
  checkout: { sessions: Pick<Stripe['checkout']['sessions'], 'create'> }
}

interface RewardRow {
  id: string
  kind: Reward['kind']
  percent: number
  label: string
  origin: Reward['origin']
  expires_at: string
  used_at: string | null
  stripe_coupon_id: string | null
}

export const toReward = (r: RewardRow): Reward => ({
  id: r.id,
  kind: r.kind,
  percent: r.percent,
  label: r.label,
  origin: r.origin,
  expiresAt: r.expires_at,
  usedAt: r.used_at,
  stripeCouponId: r.stripe_coupon_id,
})

export function toSettings(r: { tiers: RewardTier[]; referee_percent: number; reward_validity_days: number } | null): Settings {
  if (!r) return DEFAULT_SETTINGS
  return { tiers: r.tiers, refereePercent: r.referee_percent, rewardValidityDays: r.reward_validity_days }
}

export interface FormationRow {
  id: string
  slug: string
  title: string
  subtitle: string
  price_cents: number
  status: string
}

/** Nouvelle récompense de palier (renvoyée par fulfill_purchase) */
export interface NewRewardRow {
  reward_id: string
  reward_user_id: string
  reward_percent: number
  reward_label: string
  reward_expires_at: string
}

const toUnix = (iso: string) => Math.floor(new Date(iso).getTime() / 1000)

/** Coupon Stripe à usage unique d'une récompense, créé au besoin et mémorisé sur la récompense. */
export async function rewardCoupon(
  stripe: StripeLike,
  db: SupabaseClient,
  userId: string,
  reward: Pick<Reward, 'id' | 'percent' | 'label' | 'expiresAt' | 'stripeCouponId'>,
): Promise<string> {
  if (reward.stripeCouponId) {
    const existing = await stripe.coupons.retrieve(reward.stripeCouponId).catch(() => null)
    if (existing && existing.valid) return existing.id
  }
  const coupon = await stripe.coupons.create({
    percent_off: reward.percent,
    duration: 'once',
    max_redemptions: 1,
    redeem_by: toUnix(reward.expiresAt),
    name: (reward.label || 'Récompense parrainage').slice(0, 40),
    metadata: { user_id: userId, reward_id: reward.id },
  })
  check(await db.from('rewards').update({ stripe_coupon_id: coupon.id }).eq('id', reward.id))
  return coupon.id
}

/** Coupons des récompenses de palier venant d'être créées (sinon créés au passage en caisse). */
export async function createTierCoupons(stripe: StripeLike, db: SupabaseClient, rows: NewRewardRow[] | null) {
  for (const r of rows ?? []) {
    try {
      await rewardCoupon(stripe, db, r.reward_user_id, {
        id: r.reward_id,
        percent: r.reward_percent,
        label: r.reward_label,
        expiresAt: r.reward_expires_at,
        stripeCouponId: null,
      })
    } catch (e) {
      console.error(`Coupon Stripe non créé pour la récompense ${r.reward_id}`, e)
    }
  }
}

export function buildCheckoutParams(input: {
  formation: FormationRow
  user: { id: string; email?: string | null }
  quote: PriceQuote
  coupon: string | null
  origin: string
}): Stripe.Checkout.SessionCreateParams {
  const { formation: f, user, quote: q, coupon, origin } = input
  const metadata: Record<string, string> = {
    kind: 'formation',
    user_id: user.id,
    formation_id: f.id,
    referee: q.refereeDiscount ? '1' : '0',
    discount_percent: String(q.percent),
  }
  if (q.reward) metadata.reward_id = q.reward.id
  const label = `Formation en ligne · ${f.title}`
  return {
    mode: 'payment',
    locale: 'fr',
    client_reference_id: user.id,
    ...(user.email ? { customer_email: user.email } : {}),
    customer_creation: 'always',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: f.price_cents,
          product_data: { name: f.title, ...(f.subtitle ? { description: f.subtitle } : {}) },
        },
      },
    ],
    ...(coupon ? { discounts: [{ coupon }] } : {}),
    metadata,
    payment_intent_data: { metadata, description: label },
    invoice_creation: {
      enabled: true,
      invoice_data: { description: label, footer: 'TVA non applicable, art. 293 B du CGI', metadata },
    },
    success_url: `${origin}/espace/merci?formation=${encodeURIComponent(f.slug)}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/espace/catalogue`,
  }
}

/** Contexte de prix d'un client (récompenses, parrain, achats, réglages). */
export async function loadQuoteContext(db: SupabaseClient, userId: string) {
  const [profile, rewards, purchases, settings] = await Promise.all([
    db.from('profiles').select('referred_by').eq('id', userId).maybeSingle(),
    db.from('rewards').select('*').eq('user_id', userId),
    db.from('purchases').select('id').eq('user_id', userId),
    db.from('settings').select('tiers, referee_percent, reward_validity_days').maybeSingle(),
  ])
  return {
    referredBy: (check(profile) as { referred_by: string | null } | null)?.referred_by ?? null,
    rewards: ((check(rewards) ?? []) as RewardRow[]).map(toReward),
    purchases: (check(purchases) ?? []) as { id: string }[],
    settings: toSettings(check(settings)),
  }
}

export async function createFormationCheckout(
  deps: { db: SupabaseClient; stripe: () => StripeLike; now?: number },
  user: { id: string; email?: string | null },
  formationId: unknown,
  origin: string,
): Promise<{ url: string }> {
  const { db } = deps
  if (typeof formationId !== 'string' || !formationId) throw new EspaceError('bad-request', 400)

  const formation = check(
    await db.from('formations').select('id, slug, title, subtitle, price_cents, status').eq('id', formationId).maybeSingle(),
  ) as FormationRow | null
  if (!formation || formation.status !== 'published') throw new EspaceError('not-found', 404)

  const enrolled = check(
    await db.from('enrollments').select('formation_id').eq('user_id', user.id).eq('formation_id', formation.id).maybeSingle(),
  )
  if (enrolled) throw new EspaceError('already-enrolled', 409)

  const merci = `${origin}/espace/merci?formation=${encodeURIComponent(formation.slug)}`

  // Formation gratuite : accès direct, sans consommer de récompense ni compter comme achat
  if (formation.price_cents === 0) {
    check(await db.rpc('grant_enrollment', { p_user_id: user.id, p_formation_id: formation.id, p_source: 'gift' }))
    return { url: merci }
  }

  const ctx = await loadQuoteContext(db, user.id)
  const q = quote({ price: formation.price_cents / 100 }, ctx, deps.now)
  const expectedCents = Math.round(q.finalPrice * 100)

  // Réduction de 100 % : rien à encaisser, l'achat est enregistré directement
  if (expectedCents <= 0) {
    const created = check(
      await db.rpc('fulfill_purchase', {
        p_user_id: user.id,
        p_formation_id: formation.id,
        p_amount_cents: 0,
        p_discount_percent: q.percent,
        p_reward_id: q.reward?.id ?? null,
        p_stripe_session_id: null,
        p_stripe_invoice_id: null,
      }),
    ) as NewRewardRow[] | null
    if (created?.length) await createTierCoupons(deps.stripe(), db, created)
    return { url: merci }
  }

  const stripe = deps.stripe()
  let coupon: string | null = null
  if (q.reward) {
    coupon = await rewardCoupon(stripe, db, user.id, q.reward)
  } else if (q.refereeDiscount) {
    const c = await stripe.coupons.create({
      percent_off: q.percent,
      duration: 'once',
      max_redemptions: 1,
      // La session Stripe expire au bout de 24 h
      redeem_by: Math.floor((deps.now ?? Date.now()) / 1000) + 25 * 3600,
      name: 'Avantage filleul',
      metadata: { user_id: user.id, kind: 'referee' },
    })
    coupon = c.id
  }

  const session = await stripe.checkout.sessions.create(buildCheckoutParams({ formation, user, quote: q, coupon, origin }))
  if (session.amount_total != null && session.amount_total !== expectedCents) {
    console.error(`Montant Stripe ${session.amount_total} ≠ montant affiché ${expectedCents} (formation ${formation.id})`)
  }
  if (!session.url) throw new EspaceError('checkout-failed', 502)
  return { url: session.url }
}
