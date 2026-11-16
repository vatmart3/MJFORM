// POST /api/espace/admin-invite (administrateurs) : ouvre l'accès à une formation et prévient
// le client par e-mail. Nouveau client : invitation (lien d'activation) ; client existant :
// lien de connexion.
//   { mode: 'grant', email, formationId, source }               → ImportResult
//   { mode: 'import', rows: CsvParticipant[], formationId, workshopId } → ImportResult
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CsvParticipant, EnrollmentSource, ImportResult } from '../../src/app/data/types.js'
import { EspaceError, check, errorResponse, espaceUrl, getServiceClient, originOf, requireAdmin, send } from '../_lib/espace.js'

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const SOURCES: EnrollmentSource[] = ['purchase', 'workshop', 'gift']
const MAX_ROWS = 500

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/** Trouve ou invite le client ; renvoie son id et, le cas échéant, l'échec d'envoi de l'e-mail. */
async function ensureMember(
  db: SupabaseClient,
  email: string,
  meta: { first_name?: string; last_name?: string; phone?: string },
  redirectTo: string,
): Promise<{ id: string; created: boolean; mailError: string | null }> {
  const found = check(await db.from('profiles').select('id').eq('email', email).maybeSingle()) as { id: string } | null
  if (found) {
    const { error } = await db.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } })
    return { id: found.id, created: false, mailError: error?.message ?? null }
  }
  const { data, error } = await db.auth.admin.inviteUserByEmail(email, { data: meta, redirectTo })
  if (data?.user) return { id: data.user.id, created: true, mailError: error?.message ?? null }
  // Compte créé malgré l'échec d'envoi, ou créé entre-temps
  const retry = check(await db.from('profiles').select('id').eq('email', email).maybeSingle()) as { id: string } | null
  if (retry) return { id: retry.id, created: true, mailError: error?.message ?? null }
  throw new Error(error?.message ?? 'invite-failed')
}

async function grant(db: SupabaseClient, userId: string, formationId: string, source: EnrollmentSource) {
  check(await db.rpc('grant_enrollment', { p_user_id: userId, p_formation_id: formationId, p_source: source }))
}

export async function POST(request: Request) {
  try {
    const db = getServiceClient()
    await requireAdmin(request, db)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const formationId = str(body.formationId)
    const formation = formationId ? check(await db.from('formations').select('id').eq('id', formationId).maybeSingle()) : null
    if (!formation) throw new EspaceError('formation-not-found', 404)
    const redirectTo = espaceUrl(originOf(request))
    const result: ImportResult = { invited: 0, alreadyMember: 0, errors: [] }

    if (body.mode === 'grant') {
      const email = str(body.email).toLowerCase()
      const source = SOURCES.find((s) => s === body.source) ?? 'gift'
      if (!EMAIL.test(email)) throw new EspaceError('invalid-email', 400)
      const m = await ensureMember(db, email, {}, redirectTo)
      await grant(db, m.id, formationId, source)
      if (m.created) result.invited++
      else result.alreadyMember++
      if (m.mailError) result.errors.push(`Accès ouvert, mais e-mail non envoyé à ${email} : ${m.mailError}`)
      return send(result)
    }

    if (body.mode === 'import') {
      const rows = Array.isArray(body.rows) ? (body.rows as Partial<CsvParticipant>[]) : []
      if (rows.length > MAX_ROWS) throw new EspaceError('too-many-rows', 400)
      const workshopId = str(body.workshopId) || null
      if (workshopId && !check(await db.from('workshops').select('id').eq('id', workshopId).maybeSingle())) {
        throw new EspaceError('workshop-not-found', 404)
      }
      for (const r of rows) {
        const email = str(r.email).toLowerCase()
        if (!EMAIL.test(email)) {
          result.errors.push(`E-mail invalide : ${email || '(vide)'}`)
          continue
        }
        try {
          const firstName = str(r.firstName)
          const lastName = str(r.lastName)
          const phone = str(r.phone)
          const m = await ensureMember(db, email, { first_name: firstName, last_name: lastName, phone }, redirectTo)
          await grant(db, m.id, formationId, 'workshop')
          if (workshopId) {
            const booked = check(
              await db.from('workshop_bookings').select('id').eq('workshop_id', workshopId).eq('email', email).limit(1),
            ) as unknown[] | null
            if (!booked?.length) {
              const profile = check(
                await db.from('profiles').select('first_name, last_name, phone').eq('id', m.id).maybeSingle(),
              ) as { first_name: string; last_name: string; phone: string } | null
              check(
                await db.from('workshop_bookings').insert({
                  workshop_id: workshopId,
                  name: `${profile?.first_name ?? firstName} ${profile?.last_name ?? lastName}`.trim(),
                  email,
                  phone: profile?.phone || phone,
                  user_id: m.id,
                }),
              )
            }
          }
          if (m.created) result.invited++
          else result.alreadyMember++
          if (m.mailError) result.errors.push(`Accès ouvert, mais e-mail non envoyé à ${email} : ${m.mailError}`)
        } catch (e) {
          console.error(`Import : échec pour ${email}`, e)
          const message = e && typeof e === 'object' && 'message' in e ? String(e.message) : 'erreur inconnue'
          result.errors.push(`${email} : ${message}`)
        }
      }
      return send(result)
    }

    throw new EspaceError('bad-request', 400)
  } catch (e) {
    return errorResponse(e)
  }
}
