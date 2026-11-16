// Catalogue MJ FORM — source unique pour le comparateur, le configurateur,
// le JSON-LD et les fonctions de paiement (api/).
// Prix nets en euros : TVA non applicable, art. 293 B du CGI.
// Les prix barrés sont des prix réels (somme des ateliers du pack).

/** 'special' : atelier ponctuel (pilote), proposé en tête de la réservation mais hors comparateur. */
export type LevelId = 'n1' | 'n2' | 'special'

export interface Atelier {
  id: string
  level: LevelId
  name: string
  duration: string
  /** Durée ISO 8601 pour le JSON-LD */
  isoDuration: string
  price: number
  /** Prix barré réel, uniquement pour les packs */
  compareAt?: number
  pitch: string
  takeaways: string[]
  pack?: boolean
  /** Mention affichée à côté du prix (ex. prix de lancement) */
  priceNote?: string
}

export interface Level {
  id: LevelId
  label: string
  name: string
  tagline: string
}

export const LEVELS: Level[] = [
  {
    id: 'n1',
    label: 'Niveau 1',
    name: 'Démarrer',
    tagline: 'Les bons réflexes. Dès demain matin.',
  },
  {
    id: 'n2',
    label: 'Niveau 2',
    name: 'Passer à l’IA pour de vrai',
    tagline: 'Vos outils. Vos agents. Votre avance.',
  },
]

export const ATELIERS: Atelier[] = [
  {
    id: 'fetes',
    level: 'special',
    name: 'Atelier spécial fêtes',
    duration: '3 h',
    isoDuration: 'PT3H',
    price: 49,
    priceNote: 'prix de lancement (ensuite 149 €)',
    pitch: 'Préparez tous vos posts de fin d’année en 3 h.',
    takeaways: [
      'Vos publications de décembre et du Nouvel An, rédigées et illustrées',
      'Votre calendrier de publication jusqu’au 1er janvier',
      'Vos horaires de fêtes à jour sur Google',
    ],
  },
  {
    id: 'ia-comptoir',
    level: 'n1',
    name: 'L’IA au comptoir',
    duration: '3 h',
    isoDuration: 'PT3H',
    price: 149,
    pitch: 'ChatGPT et Claude, utilisés pour votre commerce. Pas pour faire joli.',
    takeaways: [
      'ChatGPT et Claude installés et réglés sur votre téléphone',
      'Vos 10 consignes prêtes à copier pour le quotidien',
      'Une fiche réflexe : quoi demander, quoi vérifier',
    ],
  },
  {
    id: 'google-avis',
    level: 'n1',
    name: 'Google et avis',
    duration: '3 h',
    isoDuration: 'PT3H',
    price: 129,
    pitch: 'Votre fiche Google à jour. Vos avis enfin répondus.',
    takeaways: [
      'Votre fiche Google Business revue et complétée',
      'Vos avis en attente répondus pendant l’atelier',
      'Un modèle de réponse à votre ton, réutilisable',
    ],
  },
  {
    id: 'reseaux',
    level: 'n1',
    name: 'Réseaux sociaux',
    duration: '3 h',
    isoDuration: 'PT3H',
    price: 149,
    pitch: 'Un mois de publications. Préparé en une matinée.',
    takeaways: [
      'Votre calendrier de publications sur 4 semaines',
      'Vos premiers visuels et textes, prêts à publier',
      'Une méthode de 20 minutes par semaine',
    ],
  },
  {
    id: 'zero-paperasse',
    level: 'n1',
    name: 'Zéro paperasse',
    duration: '3 h',
    isoDuration: 'PT3H',
    price: 149,
    pitch: 'Devis, factures, courriers. Sans le dimanche soir.',
    takeaways: [
      'Vos modèles de devis et de factures générés par l’IA',
      'Vos réponses types aux e-mails récurrents',
      'Un circuit simple pour ne plus rien laisser traîner',
    ],
  },
  {
    id: 'pack-n1',
    level: 'n1',
    name: 'Pack Démarrer',
    duration: '4 × 3 h',
    isoDuration: 'PT12H',
    price: 449,
    compareAt: 576,
    pack: true,
    pitch: 'Les quatre ateliers du niveau 1.',
    takeaways: ['Tout ce que contiennent les quatre ateliers', 'Les dates fixées ensemble après réservation'],
  },
  {
    id: 'maitriser-claude',
    level: 'n2',
    name: 'Maîtriser Claude',
    duration: '3 h',
    isoDuration: 'PT3H',
    price: 179,
    pitch: 'Projets, documents, consignes durables. Claude, au maximum.',
    takeaways: [
      'Vos projets Claude configurés avec vos propres documents',
      'Vos consignes permanentes rédigées à votre ton',
      'Une bibliothèque de demandes prêtes pour votre métier',
    ],
  },
  {
    id: 'agent-ia',
    level: 'n2',
    name: 'Créer son agent IA',
    duration: '6 h',
    isoDuration: 'PT6H',
    price: 349,
    pitch: 'Un assistant qui connaît votre commerce et répond à vos clients.',
    takeaways: [
      'Votre agent IA, nourri de vos horaires, tarifs et produits',
      'Testé sur de vraies questions de vos clients',
      'Prêt à brancher sur votre site ou votre messagerie',
    ],
  },
  {
    id: 'automatiser',
    level: 'n2',
    name: 'Automatiser son activité',
    duration: '6 h',
    isoDuration: 'PT6H',
    price: 349,
    pitch: 'Les tâches répétitives. Faites sans vous.',
    takeaways: [
      'Deux automatisations en service sur vos vrais outils',
      'La carte de vos tâches répétitives, chiffrée en heures',
      'La méthode pour construire les suivantes seul',
    ],
  },
  {
    id: 'solution-sans-coder',
    level: 'n2',
    name: 'Créer sa solution IA sans coder',
    duration: '6 h',
    isoDuration: 'PT6H',
    price: 390,
    pitch: 'Votre propre outil. Construit en une journée.',
    takeaways: [
      'Une première version de votre outil, en ligne',
      'Le cahier des charges des versions suivantes',
      'Les bons outils sans code pour la faire évoluer',
    ],
  },
  {
    id: 'pack-n2',
    level: 'n2',
    name: 'Pack Passer à l’IA',
    duration: '3 h + 3 × 6 h',
    isoDuration: 'PT21H',
    price: 990,
    compareAt: 1267,
    pack: true,
    pitch: 'Les quatre ateliers du niveau 2.',
    takeaways: ['Tout ce que contiennent les quatre ateliers', 'Les dates fixées ensemble après réservation'],
  },
]

export const ateliersOf = (level: LevelId) => ATELIERS.filter((a) => a.level === level)
/** Ateliers du catalogue régulier (niveaux 1 et 2, packs compris). */
export const regularAteliers = () => ATELIERS.filter((a) => a.level !== 'special')
export const SPECIAL = ATELIERS.find((a) => a.level === 'special')!
export const atelierById = (id: string) => ATELIERS.find((a) => a.id === id)

export const formatPrice = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
