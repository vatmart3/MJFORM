// Traitement des événements Stripe (après vérification de la signature dans api/stripe-webhook.ts).
// - Formation en ligne payée → achat, accès, récompense consommée, parrainage (fulfill_purchase)
// - Atelier réservé sur le site → inscription à l'atelier (record_site_booking)
// Les deux opérations sont idempotentes : Stripe peut renvoyer un même événement.
import type { SupabaseClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import { createTierCoupons, type NewRewardRow, type StripeLike } from './espace-checkout.js'
import { check } from './espace.js'

export type WebhookResult = 'formation' | 'booking' | 'booking-unknown-session' | 'ignored'

export async function handleStripeEvent(
  event: Stripe.Event,
  deps: { db: SupabaseClient; stripe: () => StripeLike },
): Promise<WebhookResult> {
  if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.async_payment_succeeded') return 'ignored'
  const cs = event.data.object
  if (cs.payment_status !== 'paid') return 'ignored'
  const md = cs.metadata ?? {}

  if (md.kind === 'formation') {
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

  if (md.session) {
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
