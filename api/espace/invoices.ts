// GET /api/espace/invoices → factures du client connecté (lien Stripe quand il existe)
import type Stripe from 'stripe'
import type { Invoice } from '../../src/app/data/types.js'
import { check, errorResponse, getServiceClient, getStripe, requireUser, send } from '../_lib/espace.js'

interface PurchaseRow {
  id: string
  label: string
  amount_cents: number
  stripe_session_id: string | null
  stripe_invoice_id: string | null
  created_at: string
  formations: { title: string } | { title: string }[] | null
}

async function documentUrl(stripe: Stripe | null, p: PurchaseRow): Promise<string | null> {
  if (!stripe) return null
  try {
    if (p.stripe_invoice_id) {
      const inv = await stripe.invoices.retrieve(p.stripe_invoice_id)
      return inv.hosted_invoice_url ?? inv.invoice_pdf ?? null
    }
    if (p.stripe_session_id) {
      const cs = await stripe.checkout.sessions.retrieve(p.stripe_session_id, { expand: ['invoice', 'payment_intent.latest_charge'] })
      const inv = cs.invoice && typeof cs.invoice === 'object' ? cs.invoice : null
      if (inv?.hosted_invoice_url) return inv.hosted_invoice_url
      const pi = cs.payment_intent && typeof cs.payment_intent === 'object' ? cs.payment_intent : null
      const charge = pi?.latest_charge && typeof pi.latest_charge === 'object' ? pi.latest_charge : null
      return charge?.receipt_url ?? null
    }
  } catch (e) {
    console.error(`Facture introuvable pour l'achat ${p.id}`, e)
  }
  return null
}

export async function GET(request: Request) {
  try {
    const db = getServiceClient()
    const user = await requireUser(request, db)
    const rows = (check(
      await db
        .from('purchases')
        .select('id, label, amount_cents, stripe_session_id, stripe_invoice_id, created_at, formations(title)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ) ?? []) as PurchaseRow[]
    let stripe: Stripe | null = null
    try {
      stripe = getStripe()
    } catch {
      stripe = null
    }
    const invoices: Invoice[] = await Promise.all(
      rows.map(async (p) => {
        const f = Array.isArray(p.formations) ? p.formations[0] : p.formations
        return {
          id: p.id,
          date: p.created_at,
          label: f?.title || p.label || 'Formation',
          amount: p.amount_cents / 100,
          url: await documentUrl(stripe, p),
        }
      }),
    )
    return send(invoices)
  } catch (e) {
    return errorResponse(e)
  }
}
