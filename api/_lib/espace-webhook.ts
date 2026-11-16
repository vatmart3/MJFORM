// Traitement des événements Stripe (après vérification de la signature dans api/stripe-webhook.ts).
// - Formation en ligne payée → achat, accès, récompense consommée, parrainage (fulfill_purchase)
// - Atelier réservé sur le site → inscription à l'atelier (record_site_booking)
// - Achat sur le site (présentiel ou en ligne) → droits dans l'espace stagiaire selon le format
//   (grant_site_purchase), avec invitation par e-mail si le compte n'existe pas encore
// Les deux opérations sont idempotentes : Stripe peut renvoyer un même événement.
import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import { createTierCoupons, type NewRewardRow, type StripeLike } from './espace-checkout.js'
import { check } from './espace.js'
import { ADDRESS_FALLBACK, formatDay, formatHours, sessionById } from '../../src/data/sessions.js'

export type WebhookResult = 'formation' | 'booking' | 'booking-unknown-session' | 'online' | 'ignored'

type Env = Record<string, string | undefined>

/** Ouvre les droits de l'acheteur dans l'espace stagiaire (invite le compte s'il n'existe pas). */
async function grantSitePurchase(cs: Stripe.Checkout.Session, db: SupabaseClient, env: Env) {
  const md = cs.metadata ?? {}
  const email = (cs.customer_details?.email ?? cs.customer_email ?? '').trim().toLowerCase()
  if (!email || !md.atelier) return
  const format = md.format === 'online' ? 'online' : 'presentiel'
  const session = md.session ? sessionById(md.session) : undefined
  const args = {
    p_email: email,
    p_atelier: md.atelier,
    p_format: format,
    p_session_external_id: session?.id ?? null,
    p_session_label: session ? `${formatDay(new Date(session.start))} · ${formatHours(session)}` : null,
    p_session_address: session ? env.ADRESSE_ATELIER?.trim() || ADDRESS_FALLBACK : null,
    p_amount_cents: cs.amount_total ?? 0,
    p_stripe_session_id: cs.id,
  }
  let granted = check(await db.rpc('grant_site_purchase', args)) as number
  if (granted === -1) {
    // Pas encore de compte : invitation (lien magique d'activation), puis droits
    const site = (env.SITE_URL || 'https://mjform.fr').replace(/\/$/, '')
    const firstName = (cs.customer_details?.name ?? '').split(' ')[0] ?? ''
    const { error } = await db.auth.admin.inviteUserByEmail(email, { redirectTo: `${site}/espace/`, data: { first_name: firstName } })
    if (error) throw error
    granted = check(await db.rpc('grant_site_purchase', args)) as number
  }
  if (granted === 0) console.warn(`Achat ${cs.id} : aucune formation liée à l'atelier ${md.atelier} (formations.site_ateliers)`)
}

export async function handleStripeEvent(
  event: Stripe.Event,
  deps: { db: SupabaseClient; stripe: () => StripeLike; env?: Env },
): Promise<WebhookResult> {
  if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.async_payment_succeeded') return 'ignored'
  const cs = event.data.object
  // « no_payment_required » : passage au présentiel entièrement couvert par l'achat en ligne
  if (cs.payment_status !== 'paid' && cs.payment_status !== 'no_payment_required') return 'ignored'
  const md = cs.metadata ?? {}
  const env = deps.env ?? process.env

  if (md.kind === 'formation') {
    if (cs.payment_status !== 'paid') return 'ignored'
    if (!md.user_id || !md.formation_id) return 'ignored'
    const invoice = typeof cs.invoice === 'string' ? cs.invoice : (cs.invoice?.id ?? null)
    const created = check(
      await deps.db.rpc('fulfill_purchase', {
        p_user_id: md.user_id,
        p_formation_id: md.formation_id,
        p_amount_cents: cs.amount_total ?? 0,
        p_discount_percent: Number.parseInt(md.discount_percent ?? '0', 10) || 0,
        p_reward_id: md.reward_id || null,
        p_stripe_session_id: cs.id,
        p_stripe_invoice_id: invoice,
      }),
    ) as NewRewardRow[] | null
    if (created?.length) await createTierCoupons(deps.stripe(), deps.db, created)
    return 'formation'
  }

  if (md.format === 'online') {
    await grantSitePurchase(cs, deps.db, env)
    return 'online'
  }

  if (md.session) {
    await grantSitePurchase(cs, deps.db, env)
    const d = cs.customer_details
    const recorded = check(
      await deps.db.rpc('record_site_booking', {
        p_external_id: md.session,
        p_name: d?.name ?? '',
        p_email: d?.email ?? cs.customer_email ?? '',
        p_phone: d?.phone ?? '',
        p_atelier: md.atelier ?? null,
        p_stripe_session_id: cs.id,
      }),
    ) as boolean
    if (!recorded) {
      // Atelier absent de la table workshops, ou événement déjà traité
      const { data } = await deps.db.from('workshops').select('id').eq('external_id', md.session).maybeSingle()
      if (!data) {
        console.warn(`Réservation ${cs.id} : aucun atelier avec external_id = ${md.session}`)
        return 'booking-unknown-session'
      }
    }
    return 'booking'
  }
  return 'ignored'
}
