// Mode démo : une « base » complète dans le navigateur (localStorage), avec comptes de test.
// Aucune donnée ne quitte l'appareil, aucun paiement réel. Sert d'espace de test tant que
// Supabase n'est pas branché, et permet de jouer tout le parcours sur une URL de prévisualisation.
import { AccessError, type AdminBackend, type Backend } from './backend'
import { activeRewards, allLessons, formationProgress, makeReferralCode, maskEmail, quote, tierLabel, tiersCrossed } from './logic'
import { SEED_FORMATIONS, SEED_SETTINGS, SEED_USERS, SEED_WORKSHOPS, type SeedUser } from './seed'
import type {
  ClientRow,
  Enrollment,
  EnrollmentSource,
  Formation,
  FullFormation,
  LessonProgress,
  Profile,
  Purchase,
  Referral,
  ReferralStatus,
  Reward,
  Settings,
  Workshop,
  WorkshopBooking,
} from './types'

const KEY = 'mjform-espace-demo-v1'
const SESSION_KEY = 'mjform-espace-demo-session'

type Owned<T> = T & { userId: string }
interface DemoReferral {
  id: string
  referrerId: string
  refereeId: string | null
  email: string
  status: ReferralStatus
  createdAt: string
}
interface DB {
  users: SeedUser[]
  formations: FullFormation[]
  enrollments: Owned<Enrollment>[]
  progress: Owned<LessonProgress>[]
  purchases: Owned<Purchase>[]
  referrals: DemoReferral[]
  rewards: Owned<Reward>[]
  workshops: Omit<Workshop, 'seatsLeft'>[]
  bookings: WorkshopBooking[]
  settings: Settings
}

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 10)}`
const now = () => new Date().toISOString()
const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString()
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString()
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

function seed(): DB {
  const formations = clone(SEED_FORMATIONS) as FullFormation[]
  const initiation = formations[0]
  const db: DB = {
    users: clone(SEED_USERS),
    formations,
    enrollments: [
      { userId: 'u-camille', formationId: initiation.id, source: 'workshop', createdAt: daysAgo(20) },
      { userId: 'u-lucas', formationId: initiation.id, source: 'purchase', createdAt: daysAgo(12) },
      { userId: 'u-sophie', formationId: initiation.id, source: 'purchase', createdAt: daysAgo(8) },
      { userId: 'u-sophie', formationId: 'f-claude', source: 'purchase', createdAt: daysAgo(3) },
    ],
    progress: [
      { userId: 'u-camille', lessonId: 'l-init-1', completedAt: daysAgo(20), videoPosition: 0 },
      { userId: 'u-camille', lessonId: 'l-init-2', completedAt: daysAgo(18), videoPosition: 0 },
      { userId: 'u-lucas', lessonId: 'l-init-1', completedAt: daysAgo(12), videoPosition: 0 },
      { userId: 'u-sophie', lessonId: 'l-init-1', completedAt: daysAgo(8), videoPosition: 0 },
      { userId: 'u-sophie', lessonId: 'l-init-2', completedAt: daysAgo(7), videoPosition: 0 },
      { userId: 'u-sophie', lessonId: 'l-init-3', completedAt: daysAgo(7), videoPosition: 0 },
    ],
    purchases: [
      { userId: 'u-lucas', id: 'p-1', formationId: initiation.id, amount: 44.1, discountPercent: 10, createdAt: daysAgo(12) },
      { userId: 'u-sophie', id: 'p-2', formationId: initiation.id, amount: 44.1, discountPercent: 10, createdAt: daysAgo(8) },
      { userId: 'u-sophie', id: 'p-3', formationId: 'f-claude', amount: 179, discountPercent: 0, createdAt: daysAgo(3) },
    ],
    referrals: [
      { id: 'r-1', referrerId: 'u-camille', refereeId: 'u-lucas', email: 'lucas.b@demo.mjform.fr', status: 'purchased', createdAt: daysAgo(14) },
      { id: 'r-2', referrerId: 'u-camille', refereeId: 'u-sophie', email: 'sophie.m@demo.mjform.fr', status: 'purchased', createdAt: daysAgo(10) },
      { id: 'r-3', referrerId: 'u-camille', refereeId: 'u-nadia', email: 'nadia.r@demo.mjform.fr', status: 'signed_up', createdAt: daysAgo(4) },
      { id: 'r-4', referrerId: 'u-camille', refereeId: null, email: 'contact@lepetitbistrot.fr', status: 'invited', createdAt: daysAgo(2) },
    ],
    rewards: [
      {
        userId: 'u-camille',
        id: 'rw-1',
        kind: 'percent',
        percent: 10,
        label: '-10 % · 1er filleul',
        origin: 'tier',
        expiresAt: daysFromNow(26),
        usedAt: null,
      },
    ],
    workshops: clone(SEED_WORKSHOPS),
    bookings: [],
    settings: clone(SEED_SETTINGS),
  }
  // Inscrits fictifs à l'atelier des fêtes (pour la liste de l'admin)
  const fetes = db.workshops[0]
  if (fetes) {
    db.bookings.push(
      { id: 'b-1', workshopId: fetes.id, name: 'Lucas Bernard', email: 'lucas.b@demo.mjform.fr', phone: '', createdAt: daysAgo(5) },
      { id: 'b-2', workshopId: fetes.id, name: 'Nadia Roux', email: 'nadia.r@demo.mjform.fr', phone: '', createdAt: daysAgo(2) },
    )
  }
  return db
}

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as DB
  } catch {
    /* stockage indisponible : base neuve en mémoire */
  }
  const db = seed()
  save(db)
  return db
}
let memory: DB | null = null
const db = () => (memory ??= load())
function save(next: DB = db()) {
  memory = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* quota dépassé (ex. grosse vidéo) : la session continue en mémoire */
  }
}

/** Réinitialise l'espace de test (bouton « Réinitialiser la démo »). */
export function resetDemo() {
  memory = seed()
  save(memory)
}

const strip = (u: SeedUser): Profile => {
  const { password: _pw, ...p } = u
  void _pw
  return p
}

const latency = <T,>(v: T, ms = 120) => new Promise<T>((r) => setTimeout(() => r(v), ms))

function sessionUser(): SeedUser | null {
  let id: string | null = null
  try {
    id = localStorage.getItem(SESSION_KEY)
  } catch {
    id = null
  }
  return db().users.find((u) => u.id === id) ?? null
}
function requireUser(): SeedUser {
  const u = sessionUser()
  if (!u) throw new Error('not-authenticated')
  return u
}
function requireAdmin() {
  const u = requireUser()
  if (u.role !== 'admin') throw new Error('forbidden')
  return u
}

const listeners = new Set<(p: Profile | null) => void>()
function setSession(u: SeedUser | null) {
  try {
    if (u) localStorage.setItem(SESSION_KEY, u.id)
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l(u ? strip(u) : null))
}

/** Plan public d'une formation : sans le contenu des leçons */
function outline(f: FullFormation): Formation {
  return {
    ...f,
    modules: f.modules.map((m) => ({
      ...m,
      lessons: m.lessons.map(({ body: _b, videoUrl: _v, slidesUrl: _s, allowDownload: _a, resources: _r, ...l }) => l),
    })),
  }
}

function findLesson(lessonId: string) {
  for (const f of db().formations) for (const m of f.modules) for (const l of m.lessons) if (l.id === lessonId) return { f, m, l }
  return null
}

function enroll(userId: string, formationId: string, source: EnrollmentSource) {
  const d = db()
  if (d.enrollments.some((e) => e.userId === userId && e.formationId === formationId)) return false
  d.enrollments.push({ userId, formationId, source, createdAt: now() })
  // Progression déjà amorcée : la leçon « atelier en présentiel » est validée d'office
  if (source === 'workshop') {
    const f = d.formations.find((x) => x.id === formationId)
    f?.modules.flatMap((m) => m.lessons).filter((l) => l.completedByWorkshop).forEach((l) => {
      if (!d.progress.some((p) => p.userId === userId && p.lessonId === l.id)) {
        d.progress.push({ userId, lessonId: l.id, completedAt: now(), videoPosition: 0 })
      }
    })
  }
  return true
}

function findOrCreateUser(email: string, referralCode?: string | null): SeedUser {
  const d = db()
  const normalized = email.trim().toLowerCase()
  let u = d.users.find((x) => x.email.toLowerCase() === normalized)
  if (u) return u
  const firstName = normalized.split('@')[0].split(/[._-]/)[0]
  const pretty = firstName.charAt(0).toUpperCase() + firstName.slice(1)
  const referrer = referralCode ? d.users.find((x) => x.referralCode === referralCode.toUpperCase()) : undefined
  u = {
    id: uid('u'),
    email: normalized,
    password: null,
    firstName: pretty,
    lastName: '',
    company: '',
    activity: '',
    phone: '',
    avatarUrl: null,
    notifyEmail: true,
    notifySms: false,
    role: 'client',
    referralCode: makeReferralCode(pretty),
    referredBy: referrer ? referrer.referralCode : null,
    createdAt: now(),
  }
  d.users.push(u)
  if (referrer) {
    const invited = d.referrals.find((r) => r.referrerId === referrer.id && r.email === normalized)
    if (invited) {
      invited.status = 'signed_up'
      invited.refereeId = u.id
    } else {
      d.referrals.push({ id: uid('r'), referrerId: referrer.id, refereeId: u.id, email: normalized, status: 'signed_up', createdAt: now() })
    }
  }
  save()
  return u
}

function seatsLeft(w: Omit<Workshop, 'seatsLeft'>) {
  return Math.max(0, w.capacity - db().bookings.filter((b) => b.workshopId === w.id).length)
}

/** Paiement validé : accès, récompense consommée, parrainage et paliers du parrain. */
function applyPurchase(user: SeedUser, formationId: string) {
  const d = db()
  const f = d.formations.find((x) => x.id === formationId)
  if (!f) throw new Error('not-found')
  const q = quote(f, {
    rewards: d.rewards.filter((r) => r.userId === user.id),
    referredBy: user.referredBy,
    purchases: d.purchases.filter((p) => p.userId === user.id),
    settings: d.settings,
  })
  const firstPurchase = !d.purchases.some((p) => p.userId === user.id)
  d.purchases.push({ userId: user.id, id: uid('p'), formationId, amount: q.finalPrice, discountPercent: q.percent, createdAt: now() })
  if (q.reward) {
    const r = d.rewards.find((x) => x.id === q.reward!.id)
    if (r) r.usedAt = now()
  }
  enroll(user.id, formationId, 'purchase')

  if (firstPurchase && user.referredBy) {
    const referrer = d.users.find((x) => x.referralCode === user.referredBy)
    const ref = referrer && d.referrals.find((r) => r.referrerId === referrer.id && r.refereeId === user.id)
    if (referrer && ref && ref.status !== 'purchased') {
      const before = d.referrals.filter((r) => r.referrerId === referrer.id && r.status === 'purchased').length
      ref.status = 'purchased'
      for (const t of tiersCrossed(before, before + 1, d.settings.tiers)) {
        d.rewards.push({
          userId: referrer.id,
          id: uid('rw'),
          kind: t.kind,
          percent: t.kind === 'free' ? 100 : t.percent,
          label: `${tierLabel(t)} · ${t.threshold} filleul${t.threshold > 1 ? 's' : ''}`,
          origin: 'tier',
          expiresAt: daysFromNow(d.settings.rewardValidityDays),
          usedAt: null,
        })
      }
    }
  }
  save()
}

const admin: AdminBackend = {
  async listFormations() {
    requireAdmin()
    return latency(clone(db().formations).sort((a, b) => a.position - b.position))
  },
  async getLesson(lessonId) {
    requireAdmin()
    const hit = findLesson(lessonId)
    if (!hit) throw new Error('not-found')
    return latency(clone(hit.l))
  },
  async saveFormation(input) {
    requireAdmin()
    const d = db()
    let f = input.id ? d.formations.find((x) => x.id === input.id) : undefined
    if (!f) {
      f = {
        id: uid('f'),
        slug: '',
        title: 'Nouvelle formation',
        subtitle: '',
        description: '',
        level: 'Initiation',
        duration: '3 h',
        price: 0,
        benefits: [],
        status: 'draft',
        position: d.formations.length,
        modules: [],
      }
      d.formations.push(f)
    }
    const { modules: _m, ...patch } = input
    void _m
    Object.assign(f, patch)
    if (!f.slug) f.slug = f.title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    save()
    return latency(clone(f))
  },
  async deleteFormation(id) {
    requireAdmin()
    const d = db()
    d.formations = d.formations.filter((f) => f.id !== id)
    d.enrollments = d.enrollments.filter((e) => e.formationId !== id)
    save()
  },
  async saveModule(m) {
    requireAdmin()
    const f = db().formations.find((x) => x.id === m.formationId)
    if (!f) throw new Error('not-found')
    let mod = m.id ? f.modules.find((x) => x.id === m.id) : undefined
    if (!mod) {
      mod = { id: uid('m'), formationId: f.id, title: m.title, position: m.position ?? f.modules.length, lessons: [] }
      f.modules.push(mod)
    } else {
      mod.title = m.title
      if (m.position != null) mod.position = m.position
    }
    save()
    return mod.id
  },
  async deleteModule(id) {
    requireAdmin()
    for (const f of db().formations) f.modules = f.modules.filter((m) => m.id !== id)
    save()
  },
  async saveLesson(input) {
    requireAdmin()
    const mod = db().formations.flatMap((f) => f.modules).find((m) => m.id === input.moduleId)
    if (!mod) throw new Error('not-found')
    let l = input.id ? mod.lessons.find((x) => x.id === input.id) : undefined
    if (!l) {
      // Leçon déplacée d'un autre module ?
      if (input.id) {
        for (const m of db().formations.flatMap((f) => f.modules)) {
          const i = m.lessons.findIndex((x) => x.id === input.id)
          if (i >= 0) [l] = m.lessons.splice(i, 1)
        }
      }
      l ??= {
        id: uid('l'),
        moduleId: mod.id,
        title: 'Nouvelle leçon',
        kind: 'text',
        durationMin: 10,
        position: mod.lessons.length,
        status: 'draft',
        body: '',
        videoUrl: null,
        slidesUrl: null,
        allowDownload: false,
        resources: [],
      }
      mod.lessons.push(l)
    }
    Object.assign(l, input, { moduleId: mod.id })
    save()
    return l.id
  },
  async deleteLesson(id) {
    requireAdmin()
    for (const m of db().formations.flatMap((f) => f.modules)) m.lessons = m.lessons.filter((l) => l.id !== id)
    save()
  },
  async reorder(kind, orderedIds) {
    requireAdmin()
    const items =
      kind === 'module'
        ? db().formations.flatMap((f) => f.modules)
        : db().formations.flatMap((f) => f.modules).flatMap((m) => m.lessons)
    orderedIds.forEach((id, i) => {
      const it = items.find((x) => x.id === id)
      if (it) it.position = i
    })
    save()
  },
  async uploadAsset(_formationId, file) {
    requireAdmin()
    // Démo : le fichier reste dans cet onglet (adresse temporaire), rien n'est envoyé.
    return URL.createObjectURL(file)
  },
  async listClients() {
    requireAdmin()
    const d = db()
    const rows: ClientRow[] = d.users
      .filter((u) => u.role === 'client')
      .map((u) => {
        const enrollments = d.enrollments.filter((e) => e.userId === u.id)
        const progress: Record<string, number> = {}
        for (const e of enrollments) {
          const f = d.formations.find((x) => x.id === e.formationId)
          if (f) progress[f.id] = formationProgress(outline(f), d.progress.filter((p) => p.userId === u.id)).ratio
        }
        const refs = d.referrals.filter((r) => r.referrerId === u.id)
        return {
          profile: strip(u),
          enrollments,
          progress,
          purchases: d.purchases.filter((p) => p.userId === u.id),
          referralsPurchased: refs.filter((r) => r.status === 'purchased').length,
          referralsTotal: refs.length,
        }
      })
    return latency(rows)
  },
  async grantFormation(email, formationId, source) {
    requireAdmin()
    const u = findOrCreateUser(email)
    enroll(u.id, formationId, source)
    save()
  },
  async importParticipants(rows, formationId, workshopId) {
    requireAdmin()
    const result = { invited: 0, alreadyMember: 0, errors: [] as string[] }
    for (const r of rows) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email)) {
        result.errors.push(`E-mail invalide : ${r.email || '(vide)'}`)
        continue
      }
      const existed = db().users.some((u) => u.email.toLowerCase() === r.email.toLowerCase())
      const u = findOrCreateUser(r.email)
      if (!existed) {
        u.firstName = r.firstName || u.firstName
        u.lastName = r.lastName
        u.phone = r.phone
      }
      enroll(u.id, formationId, 'workshop')
      if (workshopId && !db().bookings.some((b) => b.workshopId === workshopId && b.email === u.email)) {
        db().bookings.push({ id: uid('b'), workshopId, name: `${u.firstName} ${u.lastName}`.trim(), email: u.email, phone: u.phone, createdAt: now() })
      }
      if (existed) result.alreadyMember++
      else result.invited++ // Démo : le lien d'activation est simulé (connexion par « lien magique » depuis /espace)
    }
    save()
    return latency(result)
  },
  async listWorkshops() {
    requireAdmin()
    return latency(db().workshops.map((w) => ({ ...w, seatsLeft: seatsLeft(w) })).sort((a, b) => a.startsAt.localeCompare(b.startsAt)))
  },
  async saveWorkshop(input) {
    requireAdmin()
    const d = db()
    let w = input.id ? d.workshops.find((x) => x.id === input.id) : undefined
    if (!w) {
      w = { id: uid('w'), title: 'Atelier MJ FORM', startsAt: daysFromNow(30), endsAt: null, location: 'Sète', capacity: 8, bookingUrl: '/#reserver' }
      d.workshops.push(w)
    }
    const { seatsLeft: _s, ...patch } = input
    void _s
    Object.assign(w, patch)
    save()
    return latency({ ...w, seatsLeft: seatsLeft(w) })
  },
  async deleteWorkshop(id) {
    requireAdmin()
    const d = db()
    d.workshops = d.workshops.filter((w) => w.id !== id)
    d.bookings = d.bookings.filter((b) => b.workshopId !== id)
    save()
  },
  async listBookings(workshopId) {
    requireAdmin()
    return latency(db().bookings.filter((b) => b.workshopId === workshopId))
  },
  async addBooking(b) {
    requireAdmin()
    db().bookings.push({ ...b, id: uid('b'), createdAt: now() })
    save()
  },
  async saveSettings(s) {
    requireAdmin()
    db().settings = clone(s)
    save()
  },
}

export const demoBackend: Backend = {
  mode: 'demo',

  async currentUser() {
    const u = sessionUser()
    return latency(u ? strip(u) : null, 60)
  },
  onAuthChange(cb) {
    listeners.add(cb)
    return () => listeners.delete(cb)
  },
  async signInWithPassword(email, password) {
    const u = db().users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase())
    if (!u || !u.password || u.password !== password) {
      await latency(null, 400)
      throw new Error('invalid-credentials')
    }
    setSession(u)
    return latency(strip(u))
  },
  async sendMagicLink(email, referralCode) {
    // Démo : pas d'e-mail envoyé, la connexion est immédiate (création du compte si besoin).
    const u = findOrCreateUser(email, referralCode)
    await latency(null, 500)
    setSession(u)
  },
  async signInWithGoogle(referralCode) {
    const u = findOrCreateUser('invite.google@demo.mjform.fr', referralCode)
    setSession(u)
  },
  async signOut() {
    setSession(null)
  },

  async updateProfile(patch) {
    const u = requireUser()
    const { id: _i, role: _r, referralCode: _c, referredBy: _b, email: _e, createdAt: _d, ...safe } = patch
    void _i, void _r, void _c, void _b, void _e, void _d
    Object.assign(u, safe)
    save()
    listeners.forEach((l) => l(strip(u)))
    return latency(strip(u))
  },
  async uploadAvatar(file) {
    const u = requireUser()
    const url = await resizeImage(file, 256)
    u.avatarUrl = url
    save()
    listeners.forEach((l) => l(strip(u)))
    return url
  },
  async listInvoices() {
    const u = requireUser()
    const d = db()
    return latency(
      d.purchases
        .filter((p) => p.userId === u.id)
        .map((p) => ({
          id: p.id,
          date: p.createdAt,
          label: d.formations.find((f) => f.id === p.formationId)?.title ?? 'Formation',
          amount: p.amount,
          url: null,
        }))
        .reverse(),
    )
  },
  async deleteAccount() {
    const u = requireUser()
    const d = db()
    d.users = d.users.filter((x) => x.id !== u.id)
    d.enrollments = d.enrollments.filter((x) => x.userId !== u.id)
    d.progress = d.progress.filter((x) => x.userId !== u.id)
    d.rewards = d.rewards.filter((x) => x.userId !== u.id)
    save()
    setSession(null)
  },

  async listFormations() {
    return latency(
      db()
        .formations.filter((f) => f.status === 'published')
        .map(outline)
        .sort((a, b) => a.position - b.position),
    )
  },
  async listEnrollments() {
    const u = requireUser()
    return latency(db().enrollments.filter((e) => e.userId === u.id).map(({ userId: _u, ...e }) => e))
  },
  async listProgress() {
    const u = requireUser()
    return latency(db().progress.filter((p) => p.userId === u.id).map(({ userId: _u, ...p }) => p))
  },
  async getLesson(lessonId) {
    const u = requireUser()
    const hit = findLesson(lessonId)
    if (!hit || hit.l.status !== 'published') throw new Error('not-found')
    const owned = u.role === 'admin' || db().enrollments.some((e) => e.userId === u.id && e.formationId === hit.f.id)
    if (!owned) throw new AccessError()
    return latency(clone(hit.l))
  },
  async setLessonCompleted(lessonId, completed) {
    const u = requireUser()
    const d = db()
    let p = d.progress.find((x) => x.userId === u.id && x.lessonId === lessonId)
    if (!p) {
      p = { userId: u.id, lessonId, completedAt: null, videoPosition: 0 }
      d.progress.push(p)
    }
    p.completedAt = completed ? now() : null
    save()
    await latency(null, 80)
  },
  async saveVideoPosition(lessonId, seconds) {
    const u = sessionUser()
    if (!u) return
    const d = db()
    let p = d.progress.find((x) => x.userId === u.id && x.lessonId === lessonId)
    if (!p) {
      p = { userId: u.id, lessonId, completedAt: null, videoPosition: 0 }
      d.progress.push(p)
    }
    p.videoPosition = Math.floor(seconds)
    save()
  },
  async learnersCount() {
    const counts: Record<string, number> = {}
    for (const e of db().enrollments) counts[e.formationId] = (counts[e.formationId] ?? 0) + 1
    return latency(counts)
  },

  async nextWorkshop() {
    const upcoming = db()
      .workshops.filter((w) => new Date(w.startsAt).getTime() > Date.now())
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0]
    return latency(upcoming ? { ...upcoming, seatsLeft: seatsLeft(upcoming) } : null)
  },

  async getSettings() {
    return latency(clone(db().settings))
  },
  async listReferrals() {
    const u = requireUser()
    const d = db()
    return latency(
      d.referrals
        .filter((r) => r.referrerId === u.id)
        .map<Referral>((r) => {
          const referee = r.refereeId ? d.users.find((x) => x.id === r.refereeId) : null
          return {
            id: r.id,
            label: referee ? `${referee.firstName} ${referee.lastName.charAt(0)}${referee.lastName ? '.' : ''}`.trim() : maskEmail(r.email),
            status: r.status,
            createdAt: r.createdAt,
          }
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    )
  },
  async listRewards() {
    const u = requireUser()
    return latency(db().rewards.filter((r) => r.userId === u.id).map(({ userId: _u, ...r }) => r))
  },
  async startCheckout(formationId) {
    const u = requireUser()
    const d = db()
    const f = d.formations.find((x) => x.id === formationId)
    if (!f) throw new Error('not-found')
    const q = quote(f, {
      rewards: d.rewards.filter((r) => r.userId === u.id),
      referredBy: u.referredBy,
      purchases: d.purchases.filter((p) => p.userId === u.id),
      settings: d.settings,
    })
    return latency({ demo: { formationId, price: q.price, finalPrice: q.finalPrice, rewardId: q.reward?.id ?? null, refereeDiscount: q.refereeDiscount } })
  },
  async confirmDemoPayment(formationId) {
    const u = requireUser()
    applyPurchase(u, formationId)
    await latency(null, 700)
  },

  admin,
}

/** Activités récentes non utilisées : pratique pour tester le mode démo depuis la console. */
export const demoDebug = { db, resetDemo, activeRewards: () => activeRewards(db().rewards), allLessons }

async function resizeImage(file: File, size: number): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, size / Math.max(img.width, img.height))
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.85)
  } finally {
    URL.revokeObjectURL(url)
  }
}
