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

Les dates sont dans `src/data/sessions.ts` (atelier spécial fêtes le 4 décembre 2026, puis 15 et 25 janvier 2027). Les dates passées disparaissent d'elles-mêmes. Adresse affichée sur `/merci` et dans Stripe : `ADDRESS` dans le même fichier.

### Liens des flyers

`?utm_source=flyer1`, `flyer2`, `flyer3` ou `?pilote` : l'atelier spécial fêtes est présélectionné et la page s'ouvre sur la réservation.

## À compléter avant la mise en ligne

- Avis : la section est masquée (`SHOW_REVIEWS` dans `src/config.ts`). Remplacer les emplacements de `src/components/Reviews.tsx` par de vrais avis, puis passer le drapeau à `true`.
- CGV : médiateur de la consommation et clause de rétractation à valider.

## Notes de conception

- Charte MJAGENCY : blanc `#FFFFFF` et gris `#F5F5F7` en alternance, texte `#1D1D1F` / `#6E6E73`, un seul accent `#0071E3`. Pile SF Pro (`-apple-system`) avec repli Inter, logo Poppins Bold.
- Le smartphone est générique (aucune marque), dessiné en CSS et immobile. Son écran est du vrai DOM, piloté directement par la position du scroll (aucun lissage, aucune latence). Chaque scène occupe deux hauteurs d'écran : l'animation de l'écran se joue entre 10 et 70 % de la scène, puis le résultat reste affiché.
- Aucun mouvement décoratif : pas de parallaxe, pas d'effet magnétique, pas de rebond. Les changements se font par fondus courts.
- Écran de chargement présent dans le HTML (`index.html`), retiré dès que la page et les polices sont prêtes (600 ms minimum, 4 s maximum même sans JavaScript).
- Vidéo de présentation (`src/components/Film.tsx`, fichiers dans `public/video/`) : lecture automatique sans le son et en boucle quand elle est visible, pause hors de l'écran, bouton « Activer le son ». Rien n'est téléchargé tant qu'elle n'approche pas de l'écran ; 720p sur mobile (3,3 Mo), 1080p sur ordinateur (7,2 Mo). L'image d'aperçu sert aussi d'image de partage (Open Graph) et la vidéo est déclarée en JSON-LD `VideoObject`. Pour la remplacer, réencoder avec `ffmpeg -i source.mp4 -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart` (ajouter `-vf scale=-2:720` pour la version mobile).
- `prefers-reduced-motion` : aucun fondu ; le contenu des scènes reste piloté par le scroll.
