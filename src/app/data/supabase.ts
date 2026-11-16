// Implémentation Supabase du Backend (production).
// - Données lues et écrites sous RLS avec la clé publique (anon) et la session du client.
// - Contenu des leçons : seulement avec un accès (RLS) ; fichiers privés servis en URL signée (1 h).
// - Paiement, factures, suppression de compte et invitations : fonctions serveur /api/espace/*.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { AccessError, type AdminBackend, type Backend } from './backend'
import { DEFAULT_SETTINGS } from './logic'
import type {
  ClientRow,
  Enrollment,
  EnrollmentSource,
  Formation,
  ImportResult,
  Invoice,
  LessonContent,
  LessonOutline,
  LessonProgress,
  Module,
  Profile,
  Purchase,
  Referral,
  Resource,
  Reward,
  RewardTier,
  Settings,
  Workshop,
  WorkshopBooking,
} from './types'

const BUCKET = 'formations'
const AVATARS = 'avatars'
const SIGNED_TTL = 3600
/** Code parrain conservé pendant la redirection Google */
const REF_KEY = 'mjform-espace-ref'

// ——— Lignes de la base (snake_case) ———

interface ProfileRow {
  id: string
  email: string
  first_name: string
  last_name: string
  company: string
  activity: string
  phone: string
  avatar_url: string | null
  notify_email: boolean
  notify_sms: boolean
  referred_by: string | null
  created_at: string
  user_roles?: { role: string }[] | { role: string } | null
  referral_codes?: { code: string }[] | { code: string } | null
  /** admin_clients() */
  role?: string
  referral_code?: string
}
interface LessonRow {
  id: string
  module_id: string
  title: string
  kind: LessonOutline['kind']
  duration_min: number
  position: number
  status: LessonOutline['status']
  completed_by_workshop: boolean
  lesson_contents?: ContentRow | ContentRow[] | null
}
interface ContentRow {
  body: string
  video_path: string | null
  slides_path: string | null
  allow_download: boolean
  resources: Resource[] | null
}
interface ModuleRow {
  id: string
  formation_id: string
  title: string
  position: number
  lessons?: LessonRow[]
}
interface FormationRow {
  id: string
  slug: string
  title: string
  subtitle: string
  description: string
  level: Formation['level']
  duration: string
  price_cents: number
  benefits: string[] | null
  status: Formation['status']
  position: number
  modules?: ModuleRow[]
}
interface RewardRow {
  id: string
  kind: Reward['kind']
  percent: number
  label: string
  origin: Reward['origin']
  expires_at: string
  used_at: string | null
  stripe_coupon_id: string | null
}
interface WorkshopRow {
  id: string
  title: string
  starts_at: string
  ends_at: string | null
  location: string
  capacity: number
  booking_url: string
  seats_left?: number | null
}
interface SettingsRow {
  tiers: RewardTier[]
  referee_percent: number
  reward_validity_days: number
}

const PROFILE_SELECT = '*, user_roles(role), referral_codes(code)'
const LESSON_COLS = 'id, module_id, title, kind, duration_min, position, status, completed_by_workshop'
const FORMATION_OUTLINE_SELECT = `id, slug, title, subtitle, description, level, duration, price_cents, benefits, status, position, modules(id, formation_id, title, position, lessons(${LESSON_COLS}))`

const many = <T,>(v: T | T[] | null | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v])
const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position

function toProfile(r: ProfileRow): Profile {
  const admin = r.role === 'admin' || many(r.user_roles).some((x) => x.role === 'admin')
  return {
    id: r.id,
    email: r.email,
    firstName: r.first_name ?? '',
    lastName: r.last_name ?? '',
    company: r.company ?? '',
    activity: r.activity ?? '',
    phone: r.phone ?? '',
    avatarUrl: r.avatar_url,
    notifyEmail: r.notify_email,
    notifySms: r.notify_sms,
    role: admin ? 'admin' : 'client',
    referralCode: r.referral_code ?? many(r.referral_codes)[0]?.code ?? '',
    referredBy: r.referred_by,
    createdAt: r.created_at,
  }
}

const toOutline = (l: LessonRow): LessonOutline => ({
  id: l.id,
  moduleId: l.module_id,
  title: l.title,
  kind: l.kind,
  durationMin: l.duration_min,
  position: l.position,
  status: l.status,
  completedByWorkshop: l.completed_by_workshop,
})

const toContent = (l: LessonRow, c: ContentRow): LessonContent => ({
  ...toOutline(l),
  body: c.body ?? '',
  videoUrl: c.video_path,
  slidesUrl: c.slides_path,
  allowDownload: c.allow_download,
  resources: Array.isArray(c.resources) ? c.resources : [],
})

const toModule = (m: ModuleRow): Module => ({
  id: m.id,
  formationId: m.formation_id,
  title: m.title,
  position: m.position,
  lessons: (m.lessons ?? []).map(toOutline).sort(byPosition),
})

const toFormation = (f: FormationRow): Formation => ({
  id: f.id,
  slug: f.slug,
  title: f.title,
  subtitle: f.subtitle,
  description: f.description,
  level: f.level,
  duration: f.duration,
  price: f.price_cents / 100,
  benefits: f.benefits ?? [],
  status: f.status,
  position: f.position,
  modules: (f.modules ?? []).map(toModule).sort(byPosition),
})

const toReward = (r: RewardRow): Reward => ({
  id: r.id,
  kind: r.kind,
  percent: r.percent,
  label: r.label,
  origin: r.origin,
  expiresAt: r.expires_at,
  usedAt: r.used_at,
  stripeCouponId: r.stripe_coupon_id,
})

const toWorkshop = (w: WorkshopRow): Workshop => ({
  id: w.id,
  title: w.title,
  startsAt: w.starts_at,
  endsAt: w.ends_at,
  location: w.location,
  capacity: w.capacity,
  seatsLeft: w.seats_left ?? null,
  bookingUrl: w.booking_url,
})

const toSettings = (s: SettingsRow | null): Settings =>
  s ? { tiers: s.tiers ?? [], refereePercent: s.referee_percent, rewardValidityDays: s.reward_validity_days } : DEFAULT_SETTINGS

const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** Valeur directe (fichier public du site, URL externe) ou chemin dans le bucket privé */
const isDirectUrl = (v: string) => /^(\/|https?:|blob:|data:)/i.test(v)

/** Lève l'erreur d'une requête Supabase, sinon renvoie ses données. */
function ok<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) throw new Error(res.error.code === '42501' ? 'forbidden' : res.error.message)
  return res.data
}

async function resizeToJpeg(file: File, size: number): Promise<Blob> {
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
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('image-invalide'))), 'image/jpeg', 0.85),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function createSupabaseBackend(url: string, key: string): Backend {
  const sb: SupabaseClient = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'mjform-espace-auth' },
  })
  const supabaseOrigin = new URL(url).origin
  const redirectTo = () => `${window.location.origin}/espace/`

  // ——— Session et profil ———

  const listeners = new Set<(p: Profile | null) => void>()
  const emit = (p: Profile | null) => listeners.forEach((l) => l(p))

  async function session() {
    const { data } = await sb.auth.getSession()
    return data.session
  }
  async function requireUid() {
    const s = await session()
    if (!s) throw new Error('not-authenticated')
    return s.user.id
  }

  /** Connexion Google : le code parrain conservé avant la redirection est appliqué ici. */
  let pendingClaim: Promise<void> | null = null
  function claimPendingReferral() {
    let code: string | null = null
    try {
      code = localStorage.getItem(REF_KEY)
      localStorage.removeItem(REF_KEY)
    } catch {
      code = null
    }
    if (!code) return Promise.resolve()
    pendingClaim ??= Promise.resolve(sb.rpc('claim_referral', { p_code: code }))
      .then(() => undefined, () => undefined)
      .finally(() => (pendingClaim = null))
    return pendingClaim
  }

  async function loadProfile(userId: string): Promise<Profile> {
    await claimPendingReferral()
    const row = ok(await sb.from('profiles').select(PROFILE_SELECT).eq('id', userId).maybeSingle()) as ProfileRow | null
    if (!row) throw new Error('profile-missing')
    return toProfile(row)
  }

  sb.auth.onAuthStateChange((event, s) => {
    if (event === 'TOKEN_REFRESHED') return
    // Pas d'appel Supabase directement dans ce rappel (verrou interne) : on diffère.
    setTimeout(() => {
      if (!s) return emit(null)
      loadProfile(s.user.id).then(emit, () => emit(null))
    }, 0)
  })

  async function api<T>(name: string, init: { method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<T> {
    const s = await session()
    if (!s) throw new Error('not-authenticated')
    const res = await fetch(`/api/espace/${name}`, {
      method: init.method ?? 'GET',
      headers: { Authorization: `Bearer ${s.access_token}`, ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    })
    const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null
    if (!res.ok) throw new Error(data?.error ?? `http-${res.status}`)
    return data as T
  }

  // ——— Fichiers privés ———

  /** URL signée de stockage → chemin (pour ne jamais enregistrer une URL qui expire) */
  function toStoredValue(v: string | null | undefined): string | null {
    if (!v) return null
    const value = v.trim()
    if (!value.startsWith(supabaseOrigin)) return value || null
    const m = /\/storage\/v1\/object\/(?:sign|public|authenticated)\/formations\/([^?#]+)/.exec(value)
    return m ? decodeURIComponent(m[1]) : value
  }

  /** Chemins du bucket → URL signées (1 h) ; les URL directes restent telles quelles */
  async function signAll(lessons: LessonContent[]): Promise<LessonContent[]> {
    const paths = new Set<string>()
    for (const l of lessons) {
      for (const v of [l.videoUrl, l.slidesUrl, ...l.resources.map((r) => r.url)]) if (v && !isDirectUrl(v)) paths.add(v)
    }
    const signed = new Map<string, string>()
    if (paths.size) {
      const { data } = await sb.storage.from(BUCKET).createSignedUrls([...paths], SIGNED_TTL)
      for (const item of data ?? []) if (item.path && item.signedUrl && !item.error) signed.set(item.path, item.signedUrl)
    }
    const resolve = (v: string | null) => (!v ? null : isDirectUrl(v) ? v : (signed.get(v) ?? null))
    return lessons.map((l) => ({
      ...l,
      videoUrl: resolve(l.videoUrl),
      slidesUrl: resolve(l.slidesUrl),
      resources: l.resources.flatMap((r) => {
        const u = resolve(r.url)
        return u ? [{ ...r, url: u }] : []
      }),
    }))
  }

  async function fetchLesson(lessonId: string) {
    return ok(
      await sb.from('lessons').select(`${LESSON_COLS}, lesson_contents(body, video_path, slides_path, allow_download, resources)`).eq('id', lessonId).maybeSingle(),
    ) as LessonRow | null
  }

  async function count(table: string, column: string, value: string) {
    const { count: n, error } = await sb.from(table).select('id', { count: 'exact', head: true }).eq(column, value)
    if (error) throw new Error(error.message)
    return n ?? 0
  }

  async function workshopById(id: string) {
    const row = ok(await sb.rpc('workshops_with_seats').eq('id', id).maybeSingle()) as WorkshopRow | null
    if (!row) throw new Error('not-found')
    return toWorkshop(row)
  }

  // ——— Admin (droits complets par RLS pour le rôle admin) ———

  const admin: AdminBackend = {
    async listFormations() {
      const rows = ok(await sb.from('formations').select(FORMATION_OUTLINE_SELECT).order('position')) as FormationRow[]
      return rows.map(toFormation)
    },
    async getLesson(lessonId) {
      const row = await fetchLesson(lessonId)
      const content = row && many(row.lesson_contents)[0]
      if (!row || !content) throw new Error('not-found')
      return (await signAll([toContent(row, content)]))[0]
    },
    async saveFormation(input) {
      const patch: Record<string, unknown> = {}
      if (input.title !== undefined) patch.title = input.title
      if (input.subtitle !== undefined) patch.subtitle = input.subtitle
      if (input.description !== undefined) patch.description = input.description
      if (input.level !== undefined) patch.level = input.level
      if (input.duration !== undefined) patch.duration = input.duration
      if (input.price !== undefined) patch.price_cents = Math.round(input.price * 100)
      if (input.benefits !== undefined) patch.benefits = input.benefits
      if (input.status !== undefined) patch.status = input.status
      if (input.position !== undefined) patch.position = input.position

      const existing = input.id
        ? (ok(await sb.from('formations').select('id, title').eq('id', input.id).maybeSingle()) as { id: string; title: string } | null)
        : null
      const title = (patch.title as string | undefined) ?? existing?.title ?? 'Nouvelle formation'
      if (input.slug !== undefined || !existing) {
        // Adresse unique, dérivée du titre si vide
        const base = slugify(input.slug || title) || 'formation'
        let slug = base
        for (let i = 2; i < 50; i++) {
          let q = sb.from('formations').select('id').eq('slug', slug)
          if (existing) q = q.neq('id', existing.id)
          const taken = ok(await q.limit(1)) as unknown[]
          if (!taken.length) break
          slug = `${base}-${i}`
        }
        patch.slug = slug
      }

      let id: string
      if (existing) {
        ok(await sb.from('formations').update(patch).eq('id', existing.id))
        id = existing.id
      } else {
        const { count: n } = await sb.from('formations').select('id', { count: 'exact', head: true })
        const row = ok(
          await sb
            .from('formations')
            .insert({ ...(input.id ? { id: input.id } : {}), title, position: n ?? 0, ...patch })
            .select('id')
            .single(),
        ) as { id: string }
        id = row.id
      }
      const saved = ok(await sb.from('formations').select(FORMATION_OUTLINE_SELECT).eq('id', id).single()) as FormationRow
      return toFormation(saved)
    },
    async deleteFormation(id) {
      // Fichiers du cours (au mieux), puis la formation : modules, leçons et accès suivent en cascade
      const { data: files } = await sb.storage.from(BUCKET).list(id, { limit: 1000 })
      if (files?.length) await sb.storage.from(BUCKET).remove(files.map((f) => `${id}/${f.name}`))
      ok(await sb.from('formations').delete().eq('id', id))
    },
    async saveModule(m) {
      if (m.id) {
        const patch: Record<string, unknown> = { title: m.title }
        if (m.position != null) patch.position = m.position
        const updated = ok(await sb.from('modules').update(patch).eq('id', m.id).select('id')) as { id: string }[]
        if (updated.length) return m.id
      }
      const position = m.position ?? (await count('modules', 'formation_id', m.formationId))
      const row = ok(
        await sb
          .from('modules')
          .insert({ ...(m.id ? { id: m.id } : {}), formation_id: m.formationId, title: m.title, position })
          .select('id')
          .single(),
      ) as { id: string }
      return row.id
    },
    async deleteModule(id) {
      ok(await sb.from('modules').delete().eq('id', id))
    },
    async saveLesson(input) {
      const lesson: Record<string, unknown> = { module_id: input.moduleId }
      if (input.title !== undefined) lesson.title = input.title
      if (input.kind !== undefined) lesson.kind = input.kind
      if (input.durationMin !== undefined) lesson.duration_min = input.durationMin
      if (input.position !== undefined) lesson.position = input.position
      if (input.status !== undefined) lesson.status = input.status
      if (input.completedByWorkshop !== undefined) lesson.completed_by_workshop = input.completedByWorkshop

      const content: Record<string, unknown> = {}
      if (input.body !== undefined) content.body = input.body
      if (input.videoUrl !== undefined) content.video_path = toStoredValue(input.videoUrl)
      if (input.slidesUrl !== undefined) content.slides_path = toStoredValue(input.slidesUrl)
      if (input.allowDownload !== undefined) content.allow_download = input.allowDownload
      if (input.resources !== undefined) content.resources = input.resources.map((r) => ({ ...r, url: toStoredValue(r.url) ?? '' }))

      let id = input.id ?? null
      if (id) {
        const updated = ok(await sb.from('lessons').update(lesson).eq('id', id).select('id')) as { id: string }[]
        if (!updated.length) id = null
      }
      if (!id) {
        const position = input.position ?? (await count('lessons', 'module_id', input.moduleId))
        const row = ok(
          await sb
            .from('lessons')
            .insert({ ...(input.id ? { id: input.id } : {}), title: 'Nouvelle leçon', ...lesson, position })
            .select('id')
            .single(),
        ) as { id: string }
        id = row.id
      }
      if (Object.keys(content).length) {
        ok(await sb.from('lesson_contents').upsert({ lesson_id: id, ...content }, { onConflict: 'lesson_id' }))
      }
      return id
    },
    async deleteLesson(id) {
      ok(await sb.from('lessons').delete().eq('id', id))
    },
    async reorder(kind, orderedIds) {
      ok(await sb.rpc('admin_reorder', { p_kind: kind, p_ids: orderedIds }))
    },
    async uploadAsset(formationId, file) {
      const safe = file.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-80)
      const path = `${formationId}/${Date.now()}-${safe || 'fichier'}`
      ok(await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false }))
      // URL signée pour l'aperçu ; saveLesson n'en garde que le chemin
      const { data } = await sb.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL)
      return data?.signedUrl ?? path
    },

    async listClients() {
      const rows = ok(await sb.rpc('admin_clients')) as {
        profile: ProfileRow
        enrollments: { formation_id: string; source: EnrollmentSource; created_at: string }[]
        progress: Record<string, number>
        purchases: { id: string; formation_id: string | null; amount_cents: number; discount_percent: number; created_at: string }[]
        referrals_purchased: number
        referrals_total: number
      }[]
      return rows.map<ClientRow>((r) => ({
        profile: toProfile(r.profile),
        enrollments: r.enrollments.map<Enrollment>((e) => ({ formationId: e.formation_id, source: e.source, createdAt: e.created_at })),
        progress: r.progress ?? {},
        purchases: r.purchases.map<Purchase>((p) => ({
          id: p.id,
          formationId: p.formation_id ?? '',
          amount: p.amount_cents / 100,
          discountPercent: p.discount_percent,
          createdAt: p.created_at,
        })),
        referralsPurchased: r.referrals_purchased,
        referralsTotal: r.referrals_total,
      }))
    },
    async grantFormation(email, formationId, source) {
      await api<ImportResult>('admin-invite', { method: 'POST', body: { mode: 'grant', email, formationId, source } })
    },
    async importParticipants(rows, formationId, workshopId) {
      return api<ImportResult>('admin-invite', { method: 'POST', body: { mode: 'import', rows, formationId, workshopId } })
    },

    async listWorkshops() {
      const rows = ok(await sb.rpc('workshops_with_seats')) as WorkshopRow[]
      return rows.map(toWorkshop)
    },
    async saveWorkshop(input) {
      const patch: Record<string, unknown> = {}
      if (input.title !== undefined) patch.title = input.title
      if (input.startsAt !== undefined) patch.starts_at = input.startsAt
      if (input.endsAt !== undefined) patch.ends_at = input.endsAt
      if (input.location !== undefined) patch.location = input.location
      if (input.capacity !== undefined) patch.capacity = input.capacity
      if (input.bookingUrl !== undefined) patch.booking_url = input.bookingUrl
      if (input.id) {
        const updated = ok(await sb.from('workshops').update(patch).eq('id', input.id).select('id')) as { id: string }[]
        if (updated.length) return workshopById(input.id)
      }
      const row = ok(
        await sb
          .from('workshops')
          .insert({
            ...(input.id ? { id: input.id } : {}),
            starts_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
            ...patch,
          })
          .select('id')
          .single(),
      ) as { id: string }
      return workshopById(row.id)
    },
    async deleteWorkshop(id) {
      ok(await sb.from('workshops').delete().eq('id', id))
    },
    async listBookings(workshopId) {
      const rows = ok(
        await sb.from('workshop_bookings').select('id, workshop_id, name, email, phone, created_at').eq('workshop_id', workshopId).order('created_at'),
      ) as { id: string; workshop_id: string; name: string; email: string; phone: string; created_at: string }[]
      return rows.map<WorkshopBooking>((b) => ({ id: b.id, workshopId: b.workshop_id, name: b.name, email: b.email, phone: b.phone, createdAt: b.created_at }))
    },
    async addBooking(b) {
      ok(
        await sb.from('workshop_bookings').insert({ workshop_id: b.workshopId, name: b.name, email: b.email.trim().toLowerCase(), phone: b.phone }),
      )
    },
    async saveSettings(s) {
      ok(
        await sb
          .from('settings')
          .update({ tiers: s.tiers, referee_percent: s.refereePercent, reward_validity_days: s.rewardValidityDays })
          .eq('id', true),
      )
    },
  }

  // ——— Espace client ———

  return {
    mode: 'supabase',

    async currentUser() {
      const s = await session()
      return s ? loadProfile(s.user.id) : null
    },
    onAuthChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    async signInWithPassword(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
      if (error || !data.user) throw new Error('invalid-credentials')
      return loadProfile(data.user.id)
    },
    async sendMagicLink(email, referralCode) {
      const code = referralCode?.trim().toUpperCase() || null
      const { error } = await sb.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        // ref : lu par le déclencheur d'inscription (parrainage) ; ignoré pour un compte existant
        options: { emailRedirectTo: redirectTo(), shouldCreateUser: true, ...(code ? { data: { ref: code } } : {}) },
      })
      if (error) throw new Error(error.code ?? error.message)
    },
    async signInWithGoogle(referralCode) {
      try {
        if (referralCode) localStorage.setItem(REF_KEY, referralCode.trim().toUpperCase())
      } catch {
        /* stockage indisponible : pas de parrainage */
      }
      const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTo() } })
      if (error) throw new Error(error.code ?? error.message)
    },
    async signOut() {
      await sb.auth.signOut()
      emit(null)
    },

    async updateProfile(patch) {
      const uid = await requireUid()
      const row: Record<string, unknown> = {}
      if (patch.firstName !== undefined) row.first_name = patch.firstName
      if (patch.lastName !== undefined) row.last_name = patch.lastName
      if (patch.company !== undefined) row.company = patch.company
      if (patch.activity !== undefined) row.activity = patch.activity
      if (patch.phone !== undefined) row.phone = patch.phone
      if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl
      if (patch.notifyEmail !== undefined) row.notify_email = patch.notifyEmail
      if (patch.notifySms !== undefined) row.notify_sms = patch.notifySms
      if (Object.keys(row).length) ok(await sb.from('profiles').update(row).eq('id', uid))
      const profile = await loadProfile(uid)
      emit(profile)
      return profile
    },
    async uploadAvatar(file) {
      const uid = await requireUid()
      const before = await loadProfile(uid)
      const blob = await resizeToJpeg(file, 256)
      const path = `${uid}/${Date.now()}.jpg`
      ok(await sb.storage.from(AVATARS).upload(path, blob, { contentType: 'image/jpeg', upsert: false }))
      const publicUrl = sb.storage.from(AVATARS).getPublicUrl(path).data.publicUrl
      ok(await sb.from('profiles').update({ avatar_url: publicUrl }).eq('id', uid))
      // Ancienne photo supprimée (au mieux)
      const old = before.avatarUrl && /\/storage\/v1\/object\/public\/avatars\/([^?#]+)/.exec(before.avatarUrl)?.[1]
      if (old && old.startsWith(`${uid}/`)) await sb.storage.from(AVATARS).remove([decodeURIComponent(old)])
      emit({ ...before, avatarUrl: publicUrl })
      return publicUrl
    },
    async listInvoices() {
      return api<Invoice[]>('invoices')
    },
    async deleteAccount() {
      await api('delete-account', { method: 'POST' })
      await sb.auth.signOut({ scope: 'local' }).catch(() => undefined)
      emit(null)
    },

    async listFormations() {
      const rows = ok(await sb.from('formations').select(FORMATION_OUTLINE_SELECT).eq('status', 'published').order('position')) as FormationRow[]
      return rows.map(toFormation)
    },
    async listEnrollments() {
      const uid = await requireUid()
      // Les accès en ligne expirés ne comptent plus (même règle que has_access côté base)
      const rows = ok(
        await sb
          .from('enrollments')
          .select('formation_id, source, created_at, format, expires_at, site_atelier, session_label, session_address, stripe_session_id, amount_cents')
          .eq('user_id', uid)
          .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`),
      ) as {
        formation_id: string
        source: EnrollmentSource
        created_at: string
        format: 'presentiel' | 'online' | null
        expires_at: string | null
        site_atelier: string | null
        session_label: string | null
        session_address: string | null
        stripe_session_id: string | null
        amount_cents: number | null
      }[]
      return rows.map((e) => ({
        formationId: e.formation_id,
        source: e.source,
        createdAt: e.created_at,
        format: e.format,
        expiresAt: e.expires_at,
        siteAtelier: e.site_atelier,
        sessionLabel: e.session_label,
        sessionAddress: e.session_address,
        stripeSessionId: e.stripe_session_id,
        amountPaid: e.amount_cents == null ? null : e.amount_cents / 100,
      }))
    },
    async listProgress() {
      const uid = await requireUid()
      const rows = ok(await sb.from('lesson_progress').select('lesson_id, completed_at, video_position').eq('user_id', uid)) as {
        lesson_id: string
        completed_at: string | null
        video_position: number
      }[]
      return rows.map<LessonProgress>((p) => ({ lessonId: p.lesson_id, completedAt: p.completed_at, videoPosition: p.video_position }))
    },
    async getLesson(lessonId) {
      await requireUid()
      const row = await fetchLesson(lessonId)
      if (!row || row.status !== 'published') throw new Error('not-found')
      // Le RLS ne renvoie le contenu qu'avec un accès à la formation
      const content = many(row.lesson_contents)[0]
      if (!content) throw new AccessError()
      return (await signAll([toContent(row, content)]))[0]
    },
    async setLessonCompleted(lessonId, completed) {
      const uid = await requireUid()
      const now = new Date().toISOString()
      ok(
        await sb
          .from('lesson_progress')
          .upsert({ user_id: uid, lesson_id: lessonId, completed_at: completed ? now : null, updated_at: now }, { onConflict: 'user_id,lesson_id' }),
      )
    },
    async saveVideoPosition(lessonId, seconds) {
      const s = await session()
      if (!s) return
      await sb
        .from('lesson_progress')
        .upsert(
          { user_id: s.user.id, lesson_id: lessonId, video_position: Math.max(0, Math.floor(seconds)), updated_at: new Date().toISOString() },
          { onConflict: 'user_id,lesson_id' },
        )
    },
    async learnersCount() {
      const rows = ok(await sb.rpc('learners_count')) as { formation_id: string; count: number }[]
      return Object.fromEntries(rows.map((r) => [r.formation_id, r.count]))
    },

    async nextWorkshop() {
      const rows = ok(await sb.rpc('next_workshop')) as WorkshopRow[]
      return rows[0] ? toWorkshop(rows[0]) : null
    },

    async getSettings() {
      return toSettings(ok(await sb.from('settings').select('tiers, referee_percent, reward_validity_days').maybeSingle()) as SettingsRow | null)
    },
    async listReferrals() {
      await requireUid()
      const rows = ok(await sb.rpc('my_referrals')) as { id: string; label: string; status: Referral['status']; created_at: string }[]
      return rows.map<Referral>((r) => ({ id: r.id, label: r.label, status: r.status, createdAt: r.created_at }))
    },
    async listRewards() {
      const uid = await requireUid()
      const rows = ok(await sb.from('rewards').select('*').eq('user_id', uid).order('created_at', { ascending: false })) as RewardRow[]
      return rows.map(toReward)
    },
    async startCheckout(formationId) {
      const { url: checkoutUrl } = await api<{ url: string }>('checkout', { method: 'POST', body: { formationId } })
      return { url: checkoutUrl }
    },

    admin,
  }
}
