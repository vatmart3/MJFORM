# MJ FORM

Site de MJ FORM, la branche formation de MJ LAB : ateliers IA pour commerçants et entrepreneurs du Bassin de Thau (Sète).

Vite + React + TypeScript · Supabase · Stripe Checkout. Aucune bibliothèque d'animation : défilement natif, sans latence.

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
- Coordonnées dans `.env`.

## Notes de conception

- Charte MJAGENCY : blanc `#FFFFFF` et gris `#F5F5F7` en alternance, texte `#1D1D1F` / `#6E6E73`, un seul accent `#0071E3`. Pile SF Pro (`-apple-system`) avec repli Inter, logo Poppins Bold.
- Le smartphone est générique (aucune marque), dessiné en CSS et immobile. Son écran est du vrai DOM, piloté directement par la position du scroll (aucun lissage, aucune latence). Chaque scène occupe deux hauteurs d'écran : l'animation de l'écran se joue entre 10 et 70 % de la scène, puis le résultat reste affiché.
- Aucun mouvement décoratif : pas de parallaxe, pas d'effet magnétique, pas de rebond. Les changements se font par fondus courts.
- Écran de chargement présent dans le HTML (`index.html`), retiré dès que la page et les polices sont prêtes (600 ms minimum, 4 s maximum même sans JavaScript).
- Vidéo de présentation (`src/components/Film.tsx`, fichiers dans `public/video/`) : lecture automatique sans le son et en boucle quand elle est visible, pause hors de l'écran, bouton « Activer le son ». Rien n'est téléchargé tant qu'elle n'approche pas de l'écran ; 720p sur mobile (1,8 Mo), 1080p sur ordinateur (3,8 Mo). L'image d'aperçu sert aussi d'image de partage (Open Graph) et la vidéo est déclarée en JSON-LD `VideoObject`. Pour la remplacer, réencoder avec `ffmpeg -i source.mp4 -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart` (ajouter `-vf scale=-2:720` pour la version mobile).
- `prefers-reduced-motion` : aucun fondu ; le contenu des scènes reste piloté par le scroll.
