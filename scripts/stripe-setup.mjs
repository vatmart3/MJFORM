// Crée (ou met à jour) un produit et un prix Stripe pour chaque couple atelier × format.
// Chaque prix porte l'étiquette lookup_key « mjform_<atelier>_<format> » : le site les retrouve
// tout seul, sans variable d'environnement par prix.
//
//   Simulation :  STRIPE_SECRET_KEY=sk_test_… node scripts/stripe-setup.mjs --dry-run
//   Création   :  STRIPE_SECRET_KEY=sk_test_… node scripts/stripe-setup.mjs
//
// Relançable sans doublon : un produit est retrouvé par sa métadonnée mjform_key ; un prix dont
// le montant a changé est remplacé (l'étiquette est transférée, l'ancien prix est archivé).
import Stripe from 'stripe'
import { createServer } from 'vite'

const dryRun = process.argv.includes('--dry-run')
const key = process.env.STRIPE_SECRET_KEY
if (!key) {
  console.error('STRIPE_SECRET_KEY manquante.')
  process.exit(1)
}
const mode = key.startsWith('sk_live_') || key.startsWith('rk_live_') ? 'RÉEL (live)' : 'test'
console.log(`Compte Stripe en mode ${mode}${dryRun ? ' · simulation, rien n’est créé' : ''}`)

// Le catalogue est en TypeScript : on le charge via Vite
const vite = await createServer({ server: { middlewareMode: true }, logLevel: 'error', configFile: false })
const { ATELIERS, hasOnline, lookupKey, priceOf, FORMATS } = await vite.ssrLoadModule('/src/data/ateliers.ts')
await vite.close()

const stripe = new Stripe(key)

const pairs = ATELIERS.flatMap((a) => (hasOnline(a) ? ['presentiel', 'online'] : ['presentiel']).map((f) => ({ a, f })))

const products = []
for await (const p of stripe.products.list({ limit: 100 })) if (p.metadata?.mjform_key) products.push(p)

for (const { a, f } of pairs) {
  const lk = lookupKey(a.id, f)
  const amount = priceOf(a, f) * 100
  const name = `MJ FORM · ${a.name} · ${FORMATS[f].label}`
  let product = products.find((p) => p.metadata.mjform_key === lk)
  if (!product) {
    console.log(`+ produit  ${name}`)
    if (!dryRun)
      product = await stripe.products.create({
        name,
        description: f === 'online' ? `${a.pitch} Accès en ligne 12 mois.` : `${a.pitch} Atelier à Sète, contenu en ligne inclus.`,
        metadata: { mjform_key: lk, atelier: a.id, format: f },
      })
  } else if (product.name !== name || !product.active) {
    console.log(`~ produit  ${name}`)
    if (!dryRun) product = await stripe.products.update(product.id, { name, active: true })
  }
  const existing = (await stripe.prices.list({ lookup_keys: [lk], limit: 1 })).data[0]
  if (existing && existing.active && existing.unit_amount === amount && existing.currency === 'eur') {
    console.log(`= prix     ${lk} ${amount / 100} €`)
    continue
  }
  console.log(`${existing ? '~' : '+'} prix     ${lk} ${amount / 100} €${existing ? ` (remplace ${existing.unit_amount / 100} €)` : ''}`)
  if (dryRun) continue
  await stripe.prices.create({
    product: product.id,
    currency: 'eur',
    unit_amount: amount,
    lookup_key: lk,
    transfer_lookup_key: true,
    tax_behavior: 'unspecified',
    metadata: { atelier: a.id, format: f },
  })
  if (existing?.active) await stripe.prices.update(existing.id, { active: false })
}
console.log(`Terminé : ${pairs.length} couples atelier × format.`)
