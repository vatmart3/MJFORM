// Informations liées au format acheté : session et adresse (présentiel),
// fin d'accès et passage au présentiel avec déduction (en ligne).
import { ArrowUpRight, CalendarDays, MapPin, Wifi } from 'lucide-react'
import { formatDate } from '../data/logic'
import type { Enrollment, Formation } from '../data/types'

/** Lien vers la réservation du site, avec le paiement en ligne à déduire */
export const upgradeHref = (e: Enrollment) =>
  `/?upgrade=${encodeURIComponent(e.stripeSessionId ?? '')}&atelier=${encodeURIComponent(e.siteAtelier ?? '')}${
    e.stripeSessionId?.startsWith('cs_demo_') ? `&paid=${e.amountPaid ?? 0}` : ''
  }#reserver`

export function FormatBadge({ e }: { e?: Enrollment }) {
  if (!e?.format) return null
  return e.format === 'presentiel' ? (
    <span className="badge">En présentiel</span>
  ) : (
    <span className="badge blue">En ligne{e.expiresAt ? ` · jusqu’au ${formatDate(e.expiresAt, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</span>
  )
}

export function AccessNotes({ enrollments, formations }: { enrollments: Enrollment[]; formations: Formation[] }) {
  const name = (id: string) => formations.find((f) => f.id === id)?.title ?? 'Votre formation'
  const live = enrollments.filter((e) => e.format === 'presentiel' && e.sessionLabel)
  const online = enrollments.filter((e) => e.format === 'online' && e.stripeSessionId && e.siteAtelier)
  if (!live.length && !online.length) return null
  return (
    <div className="access-notes">
      {live.map((e) => (
        <section key={`l-${e.formationId}`} className="access live" aria-label={`Votre atelier : ${name(e.formationId)}`}>
          <CalendarDays aria-hidden="true" />
          <div>
            <p className="access-kicker">Votre atelier en présentiel</p>
            <p className="access-title">{e.sessionLabel}</p>
            {e.sessionAddress ? (
              <p className="small muted row" style={{ gap: 4, margin: '2px 0 0' }}>
                <MapPin size={14} aria-hidden="true" /> {e.sessionAddress}
              </p>
            ) : null}
          </div>
        </section>
      ))}
      {online.map((e) => (
        <section key={`o-${e.formationId}`} className="access upgrade" aria-label={`Passer en présentiel : ${name(e.formationId)}`}>
          <Wifi aria-hidden="true" />
          <div>
            <p className="access-kicker">
              {name(e.formationId)} · en ligne{e.expiresAt ? ` jusqu’au ${formatDate(e.expiresAt)}` : ''}
            </p>
            <p className="access-title">Passez en présentiel : on déduit ce que vous avez payé.</p>
          </div>
          <a className="btn btn-secondary btn-sm" href={upgradeHref(e)}>
            Voir les dates <ArrowUpRight aria-hidden="true" />
          </a>
        </section>
      ))}
    </div>
  )
}
