// Règles métier pures, sans accès aux données : utilisées par l'interface, le mode démo
// et le serveur (api/espace), pour qu'un prix affiché soit toujours le prix encaissé.
import type { Enrollment, Formation, LessonOutline, LessonProgress, Purchase, Reward, RewardTier, Settings } from './types'

export const DEFAULT_SETTINGS: Settings = {
  tiers: [
    { threshold: 1, kind: 'percent', percent: 10 },
    { threshold: 3, kind: 'percent', percent: 30 },
    { threshold: 5, kind: 'free', percent: 100 },
  ],
  refereePercent: 10,
  rewardValidityDays: 90,
}

export const tierLabel = (t: Pick<RewardTier, 'kind' | 'percent'>) =>
  t.kind === 'free' ? 'une formation offerte' : `-${t.percent} %`

/** Récompenses encore utilisables (non utilisées, non expirées), la plus avantageuse d'abord. */
export function activeRewards(rewards: Reward[], now = Date.now()) {
  return rewards
    .filter((r) => !r.usedAt && new Date(r.expiresAt).getTime() > now)
    .sort((a, b) => b.percent - a.percent || new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime())
}

export interface PriceQuote {
  price: number
  finalPrice: number
  percent: number
  /** Récompense de parrainage appliquée */
  reward: Reward | null
  /** Avantage filleul (première formation) appliqué */
  refereeDiscount: boolean
  expiresAt: string | null
}

/**
 * Prix d'une formation pour un client : la meilleure réduction disponible s'applique
 * (récompense de palier, ou avantage filleul sur la première formation). Jamais cumulées.
 */
export function quote(
  formation: Pick<Formation, 'price'>,
  ctx: { rewards: Reward[]; referredBy: string | null; purchases: Pick<Purchase, 'id'>[]; settings: Settings },
  now = Date.now(),
): PriceQuote {
  const best = activeRewards(ctx.rewards, now)[0] ?? null
  const refereePercent = ctx.referredBy && ctx.purchases.length === 0 ? ctx.settings.refereePercent : 0
  if (best && best.percent >= refereePercent) {
    return {
      price: formation.price,
      finalPrice: roundPrice(formation.price * (1 - best.percent / 100)),
      percent: best.percent,
      reward: best,
      refereeDiscount: false,
      expiresAt: best.expiresAt,
    }
  }
  if (refereePercent > 0) {
    return {
      price: formation.price,
      finalPrice: roundPrice(formation.price * (1 - refereePercent / 100)),
      percent: refereePercent,
      reward: null,
      refereeDiscount: true,
      expiresAt: null,
    }
  }
  return { price: formation.price, finalPrice: formation.price, percent: 0, reward: null, refereeDiscount: false, expiresAt: null }
}

/** Arrondi au centime */
export const roundPrice = (n: number) => Math.round(n * 100) / 100

/** Paliers atteints et prochain palier, à partir du nombre de filleuls ayant acheté. */
export function referralProgress(purchasedCount: number, tiers: RewardTier[]) {
  const sorted = [...tiers].sort((a, b) => a.threshold - b.threshold)
  const reached = sorted.filter((t) => purchasedCount >= t.threshold)
  const next = sorted.find((t) => purchasedCount < t.threshold) ?? null
  const prevThreshold = reached.length ? reached[reached.length - 1].threshold : 0
  return {
    reached,
    next,
    remaining: next ? next.threshold - purchasedCount : 0,
    /** Avancement vers le prochain palier (0 → 1) */
    ratio: next ? (purchasedCount - prevThreshold) / (next.threshold - prevThreshold) : 1,
  }
}

/** Paliers nouvellement franchis quand on passe de `before` à `after` filleuls acheteurs. */
export const tiersCrossed = (before: number, after: number, tiers: RewardTier[]) =>
  tiers.filter((t) => before < t.threshold && after >= t.threshold)

export const allLessons = (f: Formation): LessonOutline[] =>
  [...f.modules]
    .sort((a, b) => a.position - b.position)
    .flatMap((m) => [...m.lessons].sort((a, b) => a.position - b.position))
    .filter((l) => l.status === 'published')

export function formationProgress(f: Formation, progress: LessonProgress[]) {
  const lessons = allLessons(f)
  const done = new Set(progress.filter((p) => p.completedAt).map((p) => p.lessonId))
  const completed = lessons.filter((l) => done.has(l.id)).length
  return { completed, total: lessons.length, ratio: lessons.length ? completed / lessons.length : 0 }
}

/** Leçon où reprendre : la première non terminée (ou la dernière si tout est fait). */
export function resumeLesson(f: Formation, progress: LessonProgress[]) {
  const lessons = allLessons(f)
  const done = new Set(progress.filter((p) => p.completedAt).map((p) => p.lessonId))
  return lessons.find((l) => !done.has(l.id)) ?? lessons[lessons.length - 1] ?? null
}

/** Formations commencées mais pas terminées d'abord (effet Zeigarnik), puis non commencées, puis terminées. */
export function sortForResume(formations: Formation[], enrollments: Enrollment[], progress: LessonProgress[]) {
  const owned = formations.filter((f) => enrollments.some((e) => e.formationId === f.id))
  const rank = (f: Formation) => {
    const p = formationProgress(f, progress)
    if (p.completed > 0 && p.completed < p.total) return 0
    if (p.completed === 0) return 1
    return 2
  }
  return owned.sort((a, b) => rank(a) - rank(b) || a.position - b.position)
}

export const maskEmail = (email: string) => {
  const [user, domain] = email.split('@')
  if (!domain) return email
  return `${user.slice(0, 2)}${'•'.repeat(Math.max(1, user.length - 2))}@${domain}`
}

export const formatEuro = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: n % 1 ? 2 : 0 }).format(n)

export const formatDate = (iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }) =>
  new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', ...opts }).format(new Date(iso))

export const daysLeft = (iso: string, now = Date.now()) => Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 86_400_000))

/** Code de parrainage lisible, ex. CAMILLE-7K2 */
export function makeReferralCode(firstName: string, seed = Math.random()) {
  const base = (firstName || 'MJ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 8) || 'MJ'
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let suffix = ''
  let x = Math.floor(seed * 1e9)
  for (let i = 0; i < 3; i++) {
    suffix += alphabet[x % alphabet.length]
    x = Math.floor(x / alphabet.length) + 7919 * (i + 1)
  }
  return `${base}-${suffix}`
}
