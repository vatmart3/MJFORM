# MJ FORM

Site de MJ FORM, la branche formation de MJ LAB : ateliers IA pour commerçants et entrepreneurs du Bassin de Thau (Sète).

Vite + React + TypeScript · Stripe Checkout · fonctions Vercel. Aucune bibliothèque d'animation : défilement natif, sans latence.

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

## Paiement et places : Stripe uniquement

Le site est prévu pour Vercel. Les fonctions de `api/` appellent Stripe directement ; Stripe est la seule source de vérité pour les places :

- places prises = paiements Stripe Checkout réussis et non remboursés + paiements en cours (non expirés) pour la même date et le même atelier ;
- une place est retenue pendant 30 minutes le temps du paiement, puis libérée si le paiement n'aboutit pas ;
- aucune base de données, aucun webhook à configurer.

| Fonction | Rôle |
| --- | --- |
| `GET /api/availability` | Places restantes par date et par atelier |
| `POST /api/checkout` | Vérifie l'atelier, la date, le stock et le prix, puis crée la session Stripe Checkout |
| `GET /api/session?id=cs_…` | Récapitulatif affiché sur `/merci` (atelier, date, adresse, montant) |

### Variables d'environnement (Vercel → Settings → Environment Variables)

Voir `.env.example` : `STRIPE_SECRET_KEY` et un `STRIPE_PRICE_<ATELIER>` (identifiant `price_…`) par atelier. Le prix Stripe doit être en EUR et égal au prix affiché sur le site, sinon le paiement est refusé (aucun risque d'encaisser un autre montant).

Pour tester en local : mettre ces variables dans `.env.local`, puis `npm run dev` (les fonctions `api/` sont servies par Vite).

### Sessions

Les dates sont dans `src/data/sessions.ts` (atelier spécial fêtes le 4 décembre 2026, puis 15 et 25 janvier 2027). Les dates passées disparaissent d'elles-mêmes. Adresse de l'atelier affichée sur `/merci` et dans Stripe : variable d'environnement `ADRESSE_ATELIER` (vide = « Sète · l’adresse exacte vous est envoyée par SMS la veille »).

### Liens des flyers

`?utm_source=flyer1`, `flyer2`, `flyer3` ou `?pilote` : l'atelier spécial fêtes est présélectionné et la page s'ouvre sur la réservation.

## À compléter avant la mise en ligne

- Avis : la section est masquée (`SHOW_REVIEWS` dans `src/config.ts`). Remplacer les emplacements de `src/components/Reviews.tsx` par de vrais avis, puis passer le drapeau à `true`.
- CGV : clause de rétractation à valider.

## Notes de conception

- Charte MJAGENCY : blanc `#FFFFFF` et gris `#F5F5F7` en alternance, texte `#1D1D1F` / `#6E6E73`, un seul accent `#0071E3`. Pile SF Pro (`-apple-system`) avec repli Inter, logo Poppins Bold.
- Le smartphone est générique (aucune marque), dessiné en CSS et immobile. Son écran est du vrai DOM, piloté directement par la position du scroll (aucun lissage, aucune latence). Chaque scène occupe deux hauteurs d'écran : l'animation de l'écran se joue entre 10 et 70 % de la scène, puis le résultat reste affiché.
- Aucun mouvement décoratif : pas de parallaxe, pas d'effet magnétique, pas de rebond. Les changements se font par fondus courts.
- Écran de chargement présent dans le HTML (`index.html`), retiré dès que la page et les polices sont prêtes (600 ms minimum, 4 s maximum même sans JavaScript).
- Vidéo de présentation (`src/components/Film.tsx`, fichiers dans `public/video/`) : lecture automatique sans le son et en boucle quand elle est visible, pause hors de l'écran, bouton « Activer le son ». Rien n'est téléchargé tant qu'elle n'approche pas de l'écran ; 720p sur mobile (3,3 Mo), 1080p sur ordinateur (7,2 Mo). L'image d'aperçu sert aussi d'image de partage (Open Graph) et la vidéo est déclarée en JSON-LD `VideoObject`. Pour la remplacer, réencoder avec `ffmpeg -i source.mp4 -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart` (ajouter `-vf scale=-2:720` pour la version mobile).
- `prefers-reduced-motion` : aucun fondu ; le contenu des scènes reste piloté par le scroll.

## Formats : en présentiel ou en ligne

Chaque atelier existe en deux formats (`src/data/ateliers.ts`) :

| | En présentiel (recommandé, par défaut) | En ligne |
| --- | --- | --- |
| Contenu | Atelier à Sète, 2 formateurs pour 8, suivi 14 jours, **et** le contenu en ligne | Vidéos, supports et prompts pendant 12 mois |
| Prix | 129 à 990 € | +50 € par atelier ou pack (179 à 1 040 €) |
| Date | Oui | Non |

L'atelier spécial fêtes n'existe qu'en présentiel.

- **Réservation** : étape « Quel format ? » entre l'atelier et la date. En ligne, la date disparaît et un encart propose le présentiel (prochaine date, places réelles lues dans `/api/availability`, rien n'est affiché si l'information manque).
- **Prix Stripe** : un produit et un prix par couple atelier × format (21 en tout), retrouvés par leur étiquette `mjform_<atelier>_<format>`. Pour les créer ou les mettre à jour (relançable, sans doublon) :

  ```bash
  STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs --dry-run
  ```

  ```bash
  STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs
  ```

  Recommencer avec la clé `sk_live_...` avant l'ouverture des ventes réelles.
- **Après paiement** (webhook `/api/stripe-webhook`) : le compte stagiaire est créé si besoin (e-mail d'activation par lien magique, variable `SITE_URL` pour l'adresse de retour), puis les droits sont ouverts selon le format (`grant_site_purchase`, migration `20261120000000_formats.sql`) : présentiel = accès sans limite + date et adresse de la session ; en ligne = accès 12 mois. Les formations ouvertes par chaque atelier sont listées dans `formations.site_ateliers` (voir `supabase/seed.sql`).
- **Passer en présentiel** : dans l'espace, un stagiaire « en ligne » voit « Passez en présentiel : on déduit ce que vous avez payé ». Le lien ouvre la réservation avec le prix présentiel moins le montant déjà payé (minimum 0 €, vérifié par Stripe via `/api/upgrade-quote`). Une déduction ne sert qu'une fois.
- **Production** : sur le déploiement de production Vercel, l'espace de test est désactivé. Sans Supabase, `/espace` affiche « Votre espace ouvre bientôt ».

## Espace client et administration

- `/espace` : espace client (tableau de bord, mes formations, lecteur de leçons, à débloquer, parrainage, profil).
- `/admin` : back-office réservé aux administrateurs (formations → modules → leçons, clients, import CSV, ateliers, réglages).
- Code : `src/app/` (`espace/`, `admin/`, `data/` pour le modèle, les règles métier et les deux backends).

### Espace de test (mode démo)

Tant que `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` ne sont pas définis, l'espace tourne en **mode démo** : données fictives stockées dans le navigateur, paiements simulés (aucun débit), lien magique simulé (connexion immédiate). Un bouton « Réinitialiser la démo » remet les données à zéro.

| Compte | E-mail | Mot de passe |
| --- | --- | --- |
| Client (Camille, Boulangerie du Port) | `client@demo.mjform.fr` | `demo1234` |
| Admin (Jérémy) | `admin@demo.mjform.fr` | `admin1234` |
| Admin (Matheis) | `matheis@demo.mjform.fr` | `admin1234` |

Parcours à essayer : ouvrir `/espace/inscription?ref=CAMILLE-7K2` dans une fenêtre privée, s'inscrire avec un e-mail quelconque (lien simulé), débloquer l'atelier d'initiation à 44,10 € (-10 % filleul), terminer une leçon. Puis se connecter en Camille : son 3e filleul acheteur lui donne -30 %, visible sur « À débloquer ».

Dès que Supabase est configuré, l'espace bascule seul sur la vraie base (`VITE_ESPACE_DEMO=1` force le mode démo).

## Espace client : configuration Supabase et Stripe

L'espace client (`/espace/`) et l'administration (`/admin/`) fonctionnent en deux modes :

- **Démo** : sans `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (ou avec `VITE_ESPACE_DEMO=1`), tout se passe dans le navigateur avec des comptes de test (`client@demo.mjform.fr` / `demo1234`, `admin@demo.mjform.fr` / `admin1234`). Aucune donnée n'est envoyée, aucun paiement réel.
- **Production** : Supabase (comptes, formations, progression, parrainage) et Stripe (paiement des formations en ligne).

### 1. Projet Supabase

1. Créer un projet Supabase **dédié** à MJ FORM (région Europe, ex. Paris ou Francfort). Ne pas réutiliser un projet existant.
2. SQL Editor : exécuter `supabase/migrations/20261116120000_espace_client.sql`, puis `supabase/migrations/20261120000000_formats.sql`, puis `supabase/seed.sql` (les 3 formations et les ateliers du site). Avec la CLI : `supabase link` puis `supabase db push`.
3. Authentication → URL Configuration : *Site URL* `https://<domaine>/espace/`, *Redirect URLs* `https://<domaine>/espace/` (ajouter aussi `http://localhost:5173/espace/` pour le développement).
4. Authentication → Providers :
   - **Email** activé (lien magique). Les nouveaux comptes sont créés au premier lien.
   - **Google** activé : créer un identifiant OAuth dans Google Cloud (type « Application Web »), URI de redirection autorisée `https://<projet>.supabase.co/auth/v1/callback`, puis coller l'ID client et le secret dans Supabase.
5. Authentication → SMTP : configurer un SMTP personnalisé (Brevo, Postmark, Resend…). L'envoi intégré de Supabase est limité à quelques e-mails par heure, insuffisant pour l'import des participants d'un atelier. Personnaliser en français les modèles « Magic Link » et « Invite user ».
6. Storage : les buckets `formations` (privé, supports de cours servis par URL signée valable 1 h) et `avatars` (public) sont créés par la migration. Pour des vidéos lourdes, relever la limite de taille des fichiers (Storage → Settings) selon l'offre.

Sécurité : le RLS est activé sur toutes les tables. Un client ne lit que ses propres données ; le plan des formations publiées est public, mais le contenu des leçons (texte, vidéo, supports) n'est lisible qu'avec un accès à la formation. Achats, accès et récompenses ne sont écrits que par le serveur (webhook Stripe, clé `service_role`) ou par un administrateur.

### 2. Premier administrateur

Se connecter une première fois sur `/espace/` avec son adresse, puis dans le SQL Editor :

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from public.profiles where email = lower('prenom@exemple.fr')
on conflict do nothing;
```

`supabase/seed.sql` contient aussi un bloc facultatif, désactivé par défaut, qui crée les comptes de démonstration (`set mjform.demo_users = 'on';` avant d'exécuter le fichier). À réserver à un projet de test : les mots de passe sont publics.

### 3. Variables d'environnement Vercel

Voir `.env.example` :

| Variable | Rôle |
| --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Client Supabase du navigateur (clé publique « anon ») |
| `VITE_ESPACE_DEMO` | `1` force le mode démo (prévisualisations) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Fonctions serveur `api/espace/*` et webhook (clé secrète, jamais exposée) |
| `STRIPE_SECRET_KEY` | Déjà utilisée par les réservations d'ateliers |
| `STRIPE_WEBHOOK_SECRET` | Vérification de la signature du webhook |

Les variables `VITE_*` sont intégrées au moment du build : redéployer après les avoir modifiées.

### 4. Webhook Stripe

Stripe → Développeurs → Webhooks → Ajouter un endpoint : `https://<domaine>/api/stripe-webhook`, événements `checkout.session.completed` et `checkout.session.async_payment_succeeded`. Copier le secret de signature dans `STRIPE_WEBHOOK_SECRET`. En local : `stripe listen --forward-to localhost:5173/api/stripe-webhook`.

Le webhook :

- formation en ligne payée → achat enregistré, accès ouvert, récompense consommée ; au premier achat d'un filleul, parrainage « acheté » et récompenses de palier du parrain (coupon Stripe à usage unique) ;
- atelier réservé sur le site → inscription ajoutée à l'atelier correspondant (`workshops.external_id` = identifiant de la session dans `src/data/sessions.ts`).

Chaque événement peut être rejoué sans doublon.

### 5. Fonctions serveur de l'espace client

| Fonction | Rôle |
| --- | --- |
| `POST /api/espace/checkout` | Recalcule le prix (même règle que l'affichage : meilleure réduction, jamais cumulée), crée le paiement Stripe avec le coupon ; réduction de 100 % : accès direct |
| `GET /api/espace/invoices` | Factures du client (lien Stripe) |
| `POST /api/espace/delete-account` | Suppression définitive du compte (RGPD) ; les achats restent, anonymisés |
| `POST /api/espace/admin-invite` | Admin : ouvrir l'accès à une formation, importer les participants d'un atelier (invitation par e-mail) |
| `POST /api/stripe-webhook` | Voir ci-dessus |

Toutes exigent l'en-tête `Authorization: Bearer <jeton Supabase>` (sauf le webhook, signé par Stripe). Le prix des formations en ligne est celui enregistré en base (admin), pas un prix Stripe.

### 6. Contenu des formations

Dans l'admin, les vidéos et PDF téléversés vont dans le bucket privé `formations` (`<id de la formation>/<fichier>`). Une adresse qui commence par `/` ou `http` est utilisée telle quelle (fichier public du site, vidéo hébergée ailleurs). Les fichiers de démonstration de `seed.sql` (`/video/…`, `/espace-demo/…`) sont publics : les remplacer par les vrais supports avant la mise en ligne.
