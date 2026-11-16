# MJ FORM

Site de MJ FORM, la branche formation de MJ LAB : ateliers IA pour commerçants et entrepreneurs du Bassin de Thau (Sète).

Vite + React + TypeScript · react-three-fiber + drei · GSAP ScrollTrigger + Lenis · Supabase · Stripe Checkout.

## Démarrer

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
npm run dev
```

`npm run build` vérifie les types, construit le site, puis **pré-rend** la page d'accueil en HTML statique (`scripts/prerender.mjs`) : contenu visible sans JavaScript, meilleur SEO local et meilleur LCP. Le dossier `dist/` se déploie sur n'importe quel hébergement statique.

## Variables d'environnement

| Variable | Rôle |
| --- | --- |
| `VITE_SITE_URL` | URL publique (canonical, Open Graph, JSON-LD). Mettre aussi à jour `public/robots.txt` et `public/sitemap.xml`. |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Lecture des places restantes et lancement du paiement. |
| `VITE_CONTACT_PHONE`, `VITE_CONTACT_EMAIL` | Coordonnées affichées dans « Parlons de votre commerce. ». Vides = rien n'est affiché (jamais de valeur inventée). |

Sans Supabase configuré, le configurateur affiche les prochains créneaux habituels (vendredi 18 h 30, lundi 19 h) **sans aucun nombre de places**, et propose une demande par e-mail.

## Réservations : Supabase + Stripe

1. **Base** : exécuter `supabase/migrations/20261116000000_mjform_booking.sql` (tables `ateliers`, `sessions`, `bookings`, fonction publique `session_availability()`, fonction `hold_seat()` réservée au serveur). RLS activé, aucun accès direct du navigateur aux tables.
2. **Sessions** : adapter puis exécuter `supabase/seed.sql` (la session de lancement du vendredi 4 décembre 2026 à 49 € y figure).
3. **Secrets des fonctions** :

   ```bash
   supabase secrets set STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_... SITE_URL=https://mjform.fr
   ```

4. **Déploiement des fonctions** :

   ```bash
   supabase functions deploy create-checkout --no-verify-jwt
   ```

   ```bash
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```

5. **Webhook Stripe** : pointer vers `https://<projet>.supabase.co/functions/v1/stripe-webhook`, événements `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `checkout.session.async_payment_failed`.

Fonctionnement : le prix est recalculé côté serveur depuis la base ; une place est retenue de façon atomique pendant 31 minutes (le paiement Stripe expire à 30), puis confirmée par le webhook ou libérée à l'expiration. Les places affichées = capacité − places payées − paiements en cours.

Le catalogue est défini à deux endroits qui doivent rester identiques : `src/data/ateliers.ts` (affichage, JSON-LD) et la table `ateliers` (prix encaissés).

## À compléter avant la mise en ligne

- Avis : `src/components/Reviews.tsx` contient trois emplacements « À REMPLACER PAR DE VRAIS AVIS ».
- Mentions légales et CGV : les champs `à compléter` (SIRET, hébergeur, médiateur, droit de rétractation à valider).
- Image de partage `public/og.png` (1200 × 630).
- Coordonnées dans `.env`.

## Notes de conception

- Charte MJAGENCY : blanc `#FFFFFF` et gris `#F5F5F7` en alternance, texte `#1D1D1F` / `#6E6E73`, un seul accent `#0071E3`. Pile SF Pro (`-apple-system`) avec repli Inter, logo Poppins Bold.
- Le smartphone 3D est générique (aucune marque). Son écran est du vrai DOM projeté par `drei <Html transform>`, piloté par la progression du scroll. La 3D se charge au premier geste de l'utilisateur ; un téléphone CSS identique s'affiche avant et sert de repli sans WebGL.
- `prefers-reduced-motion` : pas de Lenis, pas d'animations d'entrée, téléphone immobile ; le contenu des scènes reste piloté par le scroll.
