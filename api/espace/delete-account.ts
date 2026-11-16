// POST /api/espace/delete-account : suppression définitive du compte (RGPD).
// Profil, accès, progression, récompenses et parrainages sont supprimés en cascade ;
// les achats restent, anonymisés, pour la comptabilité (factures conservées par Stripe).
import { errorResponse, getServiceClient, requireUser, send } from '../_lib/espace.js'

export async function POST(request: Request) {
  try {
    const db = getServiceClient()
    const user = await requireUser(request, db)

    const { data: files } = await db.storage.from('avatars').list(user.id, { limit: 100 })
    if (files?.length) await db.storage.from('avatars').remove(files.map((f) => `${user.id}/${f.name}`))

    const { error } = await db.auth.admin.deleteUser(user.id)
    if (error) throw error
    return send({ ok: true })
  } catch (e) {
    return errorResponse(e)
  }
}
