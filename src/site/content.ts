// Contenu de référence du site MJ FORM (accueil, données structurées, futures pages).
// Aucun chiffre ni avis inventé : uniquement les informations fournies par MJ FORM.

export const CONTACT = {
  email: 'mjagency.officiel@gmail.com',
  phone: '06 11 71 83 68',
  tel: '+33611718368',
}

export const AREA = ['Sète', 'Frontignan', 'Balaruc', 'Montpellier']

export interface Offer {
  id: string
  kind: 'atelier' | 'formation'
  title: string
  summary: string
  topics: string[]
  /** Pastel de la carte (style guide) */
  tone: 'mint' | 'marigold' | 'periwinkle' | 'sky'
  tag: string
  price?: string
}

export const OFFERS: Offer[] = [
  {
    id: 'decouverte',
    kind: 'atelier',
    title: 'Atelier découverte',
    summary: 'Comprendre l’IA et l’utiliser au quotidien, sans jargon.',
    topics: ['Rédaction', 'Réseaux sociaux', 'E-mails', 'Devis', 'Organisation'],
    tone: 'mint',
    tag: 'Atelier · pour commencer',
  },
  {
    id: 'fetes',
    kind: 'atelier',
    title: 'Spécial fêtes de fin d’année',
    summary: 'Préparer ses communications, promotions et contenus de décembre avec l’IA.',
    topics: ['Communications', 'Promotions', 'Contenus de décembre'],
    tone: 'marigold',
    tag: 'Atelier pilote · 4 décembre',
    price: '49 €',
  },
  {
    id: 'claude',
    kind: 'formation',
    title: 'Maîtriser Claude et les assistants IA',
    summary: 'Utiliser Claude et les assistants IA comme un pro, au service de votre activité.',
    topics: ['Assistants IA', 'Méthodes de travail', 'Vos documents'],
    tone: 'periwinkle',
    tag: 'Formation avancée',
  },
  {
    id: 'agents',
    kind: 'formation',
    title: 'Créer ses propres agents IA',
    summary: 'Construire des agents qui automatisent les tâches répétitives de votre entreprise.',
    topics: ['Agents IA', 'Automatisation', 'Tâches répétitives'],
    tone: 'sky',
    tag: 'Formation avancée',
  },
  {
    id: 'solutions',
    kind: 'formation',
    title: 'Concevoir ses solutions IA',
    summary: 'Imaginer et concevoir des outils IA taillés pour votre entreprise.',
    topics: ['Conception', 'Outils sur mesure', 'Votre entreprise'],
    tone: 'mint',
    tag: 'Formation avancée',
  },
]

export const NEXT_WORKSHOP = {
  title: 'Atelier pilote « Spécial fêtes »',
  date: '2026-12-04',
  dateLabel: 'Vendredi 4 décembre 2026',
  when: 'en soirée',
  place: 'Sète',
  price: '49 €',
}

export const USUAL_SLOTS = ['Vendredi après-midi ou soir', 'Lundi soir, à partir de 19 h']
