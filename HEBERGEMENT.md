# Héberger le nouveau site MJ FORM (branche `refonte`)

Le nouveau site est entièrement sur la branche **`refonte`** de ce dépôt. Le site actuel
(branche `claude/intelligent-brown-r2xygy`) n’est pas modifié.

## Pages

| Adresse | Contenu |
| --- | --- |
| `/` | Accueil |
| `/a-propos/` | À propos |
| `/ateliers/` | Ateliers & formations |
| `/agenda/` | Agenda / Réserver (paiement Stripe de l’atelier du 4 décembre) |
| `/contact/` | Contact |
| `/espace` | Espace stagiaire (connexion) |
| `/mentions-legales/`, `/cgv/`, `/merci/` | Pages légales et confirmation de paiement |

## Option 1 : un projet Vercel à part (recommandé)

1. Sur vercel.com : **Add New → Project**, puis importez le dépôt `vatmart3/MJFORM`.
2. Laissez les réglages détectés (framework Vite, build `npm run build`, dossier `dist`).
3. Après la création : **Settings → Git → Production Branch** = `refonte`.
4. **Settings → Environment Variables** : reprenez celles du site actuel :
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, et les identifiants de prix `STRIPE_PRICE_…`
     (ou les prix Stripe étiquetés), pour la réservation en ligne ;
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
     pour l’espace stagiaire ;
   - facultatif : `ADRESSE_ATELIER`, `SITE_URL`.
5. **Deployments → Redeploy**. Le site est en ligne sur l’adresse `….vercel.app` du projet ;
   ajoutez votre nom de domaine dans **Settings → Domains** quand vous êtes prêt.

Sans les variables Stripe, le bouton « Réserver ma place » affiche le téléphone et l’e-mail à la
place du paiement.

### Espace stagiaire : mode test (par défaut)

Pour l’instant, `/espace` s’ouvre **en mode test**, même en production : comptes fictifs, rien n’est
envoyé ni débité. Sur la page de connexion, touchez « Compte client » puis « Se connecter »
(`client@demo.mjform.fr` / `demo1234`). L’administration (`/admin`) fonctionne de la même façon
(`admin@demo.mjform.fr` / `admin1234`).

Pour passer à la vraie version (comptes réels, Supabase), ajoutez la variable `VITE_ESPACE_DEMO=0`
avec les variables Supabase, puis redéployez.

## Option 2 : remplacer le site actuel

Quand le nouveau site vous convient, fusionnez `refonte` dans la branche de production
(ou changez la Production Branch du projet Vercel existant pour `refonte`).

## Développer en local

```bash
npm install
npm run dev
```

Les papiers déchirés du collage (`public/paper/*.svg`) se régénèrent avec `node scripts/gen-paper.mjs`.
