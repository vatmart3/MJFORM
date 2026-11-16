// Modèle de données de l'espace client MJ FORM.
// Les mêmes types servent au mode démo (navigateur) et au mode Supabase (production).

export type Role = 'client' | 'admin'
export type Level = 'Initiation' | 'Intermédiaire' | 'Avancé'
export type LessonKind = 'video' | 'slides' | 'text'
export type PublishStatus = 'draft' | 'published'
/** Origine d'un accès à une formation */
export type EnrollmentSource = 'purchase' | 'workshop' | 'gift'
export type ReferralStatus = 'invited' | 'signed_up' | 'purchased'

export interface Profile {
  id: string
  email: string
  firstName: string
  lastName: string
  company: string
  activity: string
  phone: string
  avatarUrl: string | null
  notifyEmail: boolean
  notifySms: boolean
  role: Role
  referralCode: string
  /** Code de parrainage utilisé à l'inscription */
  referredBy: string | null
  createdAt: string
}

export interface Resource {
  id: string
  name: string
  url: string
  /** Taille lisible, ex. « 240 Ko » */
  size?: string
}

/** Leçon telle qu'elle apparaît dans le plan du cours (visible même verrouillée). */
export interface LessonOutline {
  id: string
  moduleId: string
  title: string
  kind: LessonKind
  durationMin: number
  position: number
  status: PublishStatus
  /** Leçon validée d'office quand l'accès vient de l'atelier en présentiel */
  completedByWorkshop?: boolean
}

/** Contenu complet d'une leçon : seulement pour une formation accessible. */
export interface LessonContent extends LessonOutline {
  /** Texte d'explication en Markdown simple (titres ##, listes, gras, liens) */
  body: string
  videoUrl: string | null
  slidesUrl: string | null
  allowDownload: boolean
  resources: Resource[]
}

export interface Module {
  id: string
  formationId: string
  title: string
  position: number
  lessons: LessonOutline[]
}

export interface Formation {
  id: string
  slug: string
  title: string
  subtitle: string
  description: string
  level: Level
  /** Durée lisible, ex. « 3 h » */
  duration: string
  /** Prix en euros (prix nets, TVA non applicable) */
  price: number
  benefits: string[]
  status: PublishStatus
  position: number
  modules: Module[]
}

/** Module et formation avec le contenu complet des leçons (admin, données internes) */
export type FullModule = Omit<Module, 'lessons'> & { lessons: LessonContent[] }
export type FullFormation = Omit<Formation, 'modules'> & { modules: FullModule[] }

export interface Enrollment {
  formationId: string
  source: EnrollmentSource
  createdAt: string
}

export interface LessonProgress {
  lessonId: string
  completedAt: string | null
  /** Dernière position de lecture vidéo, en secondes */
  videoPosition: number
}

export interface Workshop {
  id: string
  title: string
  /** ISO, heure de Paris incluse */
  startsAt: string
  endsAt: string | null
  location: string
  capacity: number
  /** Places réellement restantes. null = inconnu : rien n'est affiché. */
  seatsLeft: number | null
  bookingUrl: string
}

export interface WorkshopBooking {
  id: string
  workshopId: string
  name: string
  email: string
  phone: string
  createdAt: string
}

export interface Referral {
  id: string
  /** Nom ou e-mail masqué du filleul */
  label: string
  status: ReferralStatus
  createdAt: string
}

export type RewardKind = 'percent' | 'free'

export interface Reward {
  id: string
  kind: RewardKind
  /** Pourcentage de réduction (100 pour une formation offerte) */
  percent: number
  label: string
  /** Origine : palier de parrainage atteint, ou avantage filleul */
  origin: 'tier' | 'referee'
  expiresAt: string
  usedAt: string | null
  /** Coupon Stripe à usage unique (mode Supabase) */
  stripeCouponId?: string | null
}

export interface RewardTier {
  /** Nombre de filleuls ayant acheté */
  threshold: number
  kind: RewardKind
  percent: number
}

export interface Settings {
  tiers: RewardTier[]
  /** Réduction du filleul sur sa première formation */
  refereePercent: number
  /** Durée de validité d'une récompense, en jours */
  rewardValidityDays: number
}

export interface Invoice {
  id: string
  date: string
  label: string
  amount: number
  url: string | null
}

export interface Purchase {
  id: string
  formationId: string
  amount: number
  discountPercent: number
  createdAt: string
}

/** Vue admin d'un client */
export interface ClientRow {
  profile: Profile
  enrollments: Enrollment[]
  /** Progression par formation (0 → 1) */
  progress: Record<string, number>
  purchases: Purchase[]
  referralsPurchased: number
  referralsTotal: number
}

export interface CsvParticipant {
  firstName: string
  lastName: string
  email: string
  phone: string
}

export interface ImportResult {
  invited: number
  alreadyMember: number
  errors: string[]
}

export interface CheckoutResult {
  /** URL de paiement Stripe (production) */
  url?: string
  /** Mode démo : le paiement est simulé dans l'interface */
  demo?: { formationId: string; price: number; finalPrice: number; rewardId: string | null; refereeDiscount: boolean }
}
