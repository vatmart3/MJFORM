// Contrat d'accès aux données de l'espace client et de l'admin.
// Deux implémentations : demo.ts (navigateur, comptes de test) et supabase.ts (production).
import type {
  CheckoutResult,
  ClientRow,
  CsvParticipant,
  EnrollmentSource,
  Enrollment,
  Formation,
  ImportResult,
  Invoice,
  LessonContent,
  LessonProgress,
  Profile,
  Referral,
  Reward,
  Settings,
  Workshop,
  WorkshopBooking,
} from './types'

export class AccessError extends Error {
  constructor(message = 'locked') {
    super(message)
  }
}

export interface Backend {
  /** 'demo' : données fictives dans le navigateur ; 'supabase' : production */
  mode: 'demo' | 'supabase'

  // ——— Authentification ———
  currentUser(): Promise<Profile | null>
  onAuthChange(cb: (p: Profile | null) => void): () => void
  signInWithPassword(email: string, password: string): Promise<Profile>
  /** Envoie un lien de connexion. referralCode : code du parrain (lien ?ref=) */
  sendMagicLink(email: string, referralCode?: string | null): Promise<void>
  signInWithGoogle(referralCode?: string | null): Promise<void>
  signOut(): Promise<void>

  // ——— Profil ———
  updateProfile(patch: Partial<Profile>): Promise<Profile>
  uploadAvatar(file: File): Promise<string>
  listInvoices(): Promise<Invoice[]>
  deleteAccount(): Promise<void>

  // ——— Formations ———
  /** Formations publiées, avec leur plan (sans le contenu des leçons) */
  listFormations(): Promise<Formation[]>
  listEnrollments(): Promise<Enrollment[]>
  listProgress(): Promise<LessonProgress[]>
  /** Contenu d'une leçon. Lève AccessError si la formation n'est pas débloquée. */
  getLesson(lessonId: string): Promise<LessonContent>
  setLessonCompleted(lessonId: string, completed: boolean): Promise<void>
  saveVideoPosition(lessonId: string, seconds: number): Promise<void>
  /** Nombre réel de clients ayant accès à chaque formation (preuve sociale) */
  learnersCount(): Promise<Record<string, number>>

  // ——— Ateliers ———
  nextWorkshop(): Promise<Workshop | null>

  // ——— Parrainage et récompenses ———
  getSettings(): Promise<Settings>
  listReferrals(): Promise<Referral[]>
  listRewards(): Promise<Reward[]>
  /** Démarre le paiement d'une formation (Stripe Checkout, ou simulation en démo) */
  startCheckout(formationId: string): Promise<CheckoutResult>
  /** Démo uniquement : valide le paiement simulé */
  confirmDemoPayment?(formationId: string): Promise<void>

  // ——— Admin ———
  admin: AdminBackend
}

export interface AdminBackend {
  listFormations(): Promise<Formation[]>
  getLesson(lessonId: string): Promise<LessonContent>
  saveFormation(f: Partial<Formation> & { id?: string }): Promise<Formation>
  deleteFormation(id: string): Promise<void>
  saveModule(m: { id?: string; formationId: string; title: string; position?: number }): Promise<string>
  deleteModule(id: string): Promise<void>
  saveLesson(l: Partial<LessonContent> & { moduleId: string; id?: string }): Promise<string>
  deleteLesson(id: string): Promise<void>
  /** Nouvel ordre des modules d'une formation, ou des leçons d'un module */
  reorder(kind: 'module' | 'lesson', orderedIds: string[]): Promise<void>
  /** Téléverse une vidéo, un PDF ou une ressource ; renvoie le chemin/URL à enregistrer */
  uploadAsset(formationId: string, file: File): Promise<string>

  listClients(): Promise<ClientRow[]>
  grantFormation(email: string, formationId: string, source: EnrollmentSource): Promise<void>
  importParticipants(rows: CsvParticipant[], formationId: string, workshopId: string | null): Promise<ImportResult>

  listWorkshops(): Promise<Workshop[]>
  saveWorkshop(w: Partial<Workshop> & { id?: string }): Promise<Workshop>
  deleteWorkshop(id: string): Promise<void>
  listBookings(workshopId: string): Promise<WorkshopBooking[]>
  addBooking(b: Omit<WorkshopBooking, 'id' | 'createdAt'>): Promise<void>

  saveSettings(s: Settings): Promise<void>
}
