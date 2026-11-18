// Vue d'ensemble : statistiques calculées en direct à partir des clients, accès, progressions, achats et ateliers.
// Aucun chiffre stocké ni estimé : tout vient des mêmes données que les autres pages de l'admin.
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight, BarChart3, CalendarDays, Gift, GraduationCap, Users, Wallet } from 'lucide-react'
import { useBackend } from '../state'
import { Counter, EASE, EmptyState, Page, Skeleton, itemVariants, listVariants } from '../ui/kit'
import { formatDate } from '../data/logic'
import type { ClientRow, EnrollmentSource, Formation, Workshop } from '../data/types'
import { useLoad } from './shared'

const DAY = 86_400_000
const euro = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: n % 1 ? 2 : 0 }).format(n)
const pct = (v: number) => `${Math.round(v * 100)} %`
const SOURCE_LABEL: Record<EnrollmentSource, string> = {
  purchase: 'Achat en ligne',
  workshop: 'Atelier en présentiel',
  gift: 'Accès offert',
}

interface Data {
  clients: ClientRow[]
  formations: Formation[]
  workshops: Workshop[]
}

function computeStats({ clients: all, formations, workshops }: Data, now = Date.now()) {
  const clients = all.filter((c) => c.profile.role === 'client')
  const enrollments = clients.flatMap((c) => c.enrollments.map((e) => ({ ...e, progress: c.progress[e.formationId] ?? 0 })))
  const purchases = clients.flatMap((c) => c.purchases)

  const newLast30 = clients.filter((c) => now - Date.parse(c.profile.createdAt) <= 30 * DAY).length
  const revenue = purchases.reduce((s, p) => s + p.amount, 0)
  const avgProgress = enrollments.length ? enrollments.reduce((s, e) => s + e.progress, 0) / enrollments.length : 0

  // Engagement : de l'accès ouvert à la formation terminée
  const funnel = [
    { label: 'Accès ouverts', value: enrollments.length },
    { label: 'Formation commencée', value: enrollments.filter((e) => e.progress > 0).length },
    { label: 'À mi-parcours', value: enrollments.filter((e) => e.progress >= 0.5).length },
    { label: 'Formation terminée', value: enrollments.filter((e) => e.progress >= 1).length },
  ]

  // Nouveaux stagiaires sur les 8 dernières semaines (semaines glissantes, la plus récente à droite)
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const end = now - (7 - i) * 7 * DAY
    const start = end - 7 * DAY
    return {
      start,
      label: formatDate(new Date(start + DAY).toISOString(), { day: 'numeric', month: 'short' }),
      value: clients.filter((c) => {
        const t = Date.parse(c.profile.createdAt)
        return t > start && t <= end
      }).length,
    }
  })

  const byFormation = formations
    .map((f) => {
      const es = enrollments.filter((e) => e.formationId === f.id)
      const sales = purchases.filter((p) => p.formationId === f.id)
      return {
        id: f.id,
        title: f.title,
        learners: es.length,
        avg: es.length ? es.reduce((s, e) => s + e.progress, 0) / es.length : 0,
        done: es.filter((e) => e.progress >= 1).length,
        revenue: sales.reduce((s, p) => s + p.amount, 0),
      }
    })
    .sort((a, b) => b.learners - a.learners)

  const sources = (Object.keys(SOURCE_LABEL) as EnrollmentSource[]).map((s) => ({
    label: SOURCE_LABEL[s],
    value: enrollments.filter((e) => e.source === s).length,
  }))

  const upcoming = workshops
    .filter((w) => Date.parse(w.startsAt) > now)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .slice(0, 4)

  const referralsTotal = clients.reduce((s, c) => s + c.referralsTotal, 0)
  const referralsPurchased = clients.reduce((s, c) => s + c.referralsPurchased, 0)
  const topReferrers = clients
    .filter((c) => c.referralsTotal > 0)
    .sort((a, b) => b.referralsPurchased - a.referralsPurchased || b.referralsTotal - a.referralsTotal)
    .slice(0, 3)

  const latest = [...clients].sort((a, b) => Date.parse(b.profile.createdAt) - Date.parse(a.profile.createdAt)).slice(0, 5)

  return {
    clientsCount: clients.length,
    newLast30,
    enrollmentsCount: enrollments.length,
    perClient: clients.length ? enrollments.length / clients.length : 0,
    avgProgress,
    doneCount: funnel[3].value,
    revenue,
    purchasesCount: purchases.length,
    funnel,
    weeks,
    byFormation,
    sources,
    upcoming,
    referralsTotal,
    referralsPurchased,
    topReferrers,
    latest,
  }
}

/** Jauge horizontale (une seule couleur : la valeur se lit dans le texte à côté) */
function Meter({ value, label }: { value: number; label: string }) {
  const reduce = useReducedMotion()
  const v = Math.max(0, Math.min(1, value))
  return (
    <span className="st-meter" role="img" aria-label={label}>
      <motion.i initial={{ scaleX: reduce ? v : 0 }} animate={{ scaleX: v }} transition={{ duration: 0.9, ease: EASE }} />
    </span>
  )
}

/** Barres hebdomadaires avec info-bulle au survol / au toucher */
function WeeklyBars({ weeks }: { weeks: { label: string; value: number }[] }) {
  const reduce = useReducedMotion()
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...weeks.map((w) => w.value))
  const total = weeks.reduce((s, w) => s + w.value, 0)
  const ticks = max <= 4 ? Array.from({ length: max + 1 }, (_, i) => i) : [0, Math.round(max / 2), max]
  return (
    <figure className="st-chart">
      <div className="st-plot" onMouseLeave={() => setHover(null)}>
        <div className="st-grid" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} style={{ bottom: `${(t / max) * 100}%` }}>
              <em>{t}</em>
            </span>
          ))}
        </div>
        <div className="st-bars">
          {weeks.map((w, i) => (
            <button
              key={w.label}
              type="button"
              className={`st-bar${hover === i ? ' is-on' : ''}`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              onClick={() => setHover(i)}
              aria-label={`Semaine du ${w.label} : ${w.value} nouveau${w.value > 1 ? 'x' : ''} stagiaire${w.value > 1 ? 's' : ''}`}
            >
              <motion.i
                style={{ height: `${(w.value / max) * 100}%` }}
                initial={{ scaleY: reduce ? 1 : 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.8, delay: reduce ? 0 : i * 0.05, ease: EASE }}
              />
              {hover === i ? (
                <span className="st-tip" role="status">
                  <b>{w.value}</b> nouveau{w.value > 1 ? 'x' : ''} · sem. du {w.label}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
      <div className="st-xaxis" aria-hidden="true">
        {weeks.map((w, i) => (
          <span key={w.label} className={i % 2 ? 'st-x-odd' : undefined}>
            {w.label}
          </span>
        ))}
      </div>
      <figcaption className="small muted">
        {total} nouveau{total > 1 ? 'x' : ''} stagiaire{total > 1 ? 's' : ''} sur 8 semaines.
      </figcaption>
      {/* Version tableau pour les lecteurs d'écran */}
      <table className="sr-only">
        <caption>Nouveaux stagiaires par semaine</caption>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.label}>
              <th scope="row">Semaine du {w.label}</th>
              <td>{w.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

export function StatsPage() {
  const { admin } = useBackend()
  const { data, error } = useLoad(async () => {
    const [clients, formations, workshops] = await Promise.all([admin.listClients(), admin.listFormations(), admin.listWorkshops()])
    return { clients, formations, workshops }
  }, [admin])
  const s = useMemo(() => (data ? computeStats(data) : null), [data])

  return (
    <Page kicker="Statistiques" title="Vue d’ensemble" sub="Calculée en direct à partir de vos stagiaires, de leurs accès, de leur progression et de leurs achats.">
      {error ? (
        <p className="field err" role="alert">
          {error}
        </p>
      ) : !s ? (
        <div className="st-kpis">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} h={128} r={20} />
          ))}
        </div>
      ) : s.clientsCount === 0 ? (
        <EmptyState
          icon={<BarChart3 />}
          title="Pas encore de stagiaire"
          text="Les statistiques apparaîtront dès les premières inscriptions."
          action={
            <Link className="btn btn-primary" to="/admin/import">
              Importer des participants
            </Link>
          }
        />
      ) : (
        <motion.div className="st" variants={listVariants} initial="hidden" animate="show">
          {/* Chiffres clés */}
          <motion.section variants={itemVariants} className="st-kpis" aria-label="Chiffres clés">
            <article className="st-kpi">
              <span className="st-ico tone-mint"><Users aria-hidden="true" /></span>
              <p className="st-label">Stagiaires inscrits</p>
              <p className="st-value"><Counter value={s.clientsCount} /></p>
              <p className="st-note">+{s.newLast30} sur les 30 derniers jours</p>
            </article>
            <article className="st-kpi">
              <span className="st-ico tone-periwinkle"><GraduationCap aria-hidden="true" /></span>
              <p className="st-label">Accès aux formations</p>
              <p className="st-value"><Counter value={s.enrollmentsCount} /></p>
              <p className="st-note">{s.perClient.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} par stagiaire en moyenne</p>
            </article>
            <article className="st-kpi">
              <span className="st-ico tone-marigold"><BarChart3 aria-hidden="true" /></span>
              <p className="st-label">Progression moyenne</p>
              <p className="st-value"><Counter value={Math.round(s.avgProgress * 100)} suffix=" %" /></p>
              <p className="st-note">{s.doneCount} formation{s.doneCount > 1 ? 's' : ''} terminée{s.doneCount > 1 ? 's' : ''}</p>
            </article>
            <article className="st-kpi">
              <span className="st-ico tone-sky"><Wallet aria-hidden="true" /></span>
              <p className="st-label">Ventes dans l’espace</p>
              <p className="st-value">{euro(s.revenue)}</p>
              <p className="st-note">{s.purchasesCount} achat{s.purchasesCount > 1 ? 's' : ''} · hors réservations du site (Stripe)</p>
            </article>
          </motion.section>

          <div className="st-grid2">
            <motion.section variants={itemVariants} className="st-card" aria-labelledby="st-weeks">
              <h2 id="st-weeks" className="st-title">Nouveaux stagiaires</h2>
              <WeeklyBars weeks={s.weeks} />
            </motion.section>

            <motion.section variants={itemVariants} className="st-card" aria-labelledby="st-funnel">
              <h2 id="st-funnel" className="st-title">Engagement</h2>
              <p className="small muted st-sub">Sur l’ensemble des accès ouverts.</p>
              <ul className="st-rows">
                {s.funnel.map((f) => {
                  const share = s.funnel[0].value ? f.value / s.funnel[0].value : 0
                  return (
                    <li key={f.label}>
                      <span className="st-row-label">{f.label}</span>
                      <Meter value={share} label={`${f.label} : ${pct(share)}`} />
                      <span className="st-row-value">
                        <b>{f.value}</b> <em>{pct(share)}</em>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </motion.section>
          </div>

          <motion.section variants={itemVariants} className="st-card" aria-labelledby="st-formations">
            <div className="st-head">
              <h2 id="st-formations" className="st-title">Par formation</h2>
              <Link className="linkish small" to="/admin/formations">
                Gérer les formations <ArrowRight size={14} aria-hidden="true" style={{ verticalAlign: -2 }} />
              </Link>
            </div>
            <div className="st-table-wrap">
              <table className="st-table">
                <thead>
                  <tr>
                    <th scope="col">Formation</th>
                    <th scope="col">Stagiaires</th>
                    <th scope="col">Progression moyenne</th>
                    <th scope="col">Terminées</th>
                    <th scope="col">Ventes</th>
                  </tr>
                </thead>
                <tbody>
                  {s.byFormation.map((f) => (
                    <tr key={f.id}>
                      <th scope="row">{f.title}</th>
                      <td data-label="Stagiaires">{f.learners}</td>
                      <td data-label="Progression">
                        <span className="st-inline">
                          <Meter value={f.avg} label={`Progression moyenne : ${pct(f.avg)}`} />
                          <em>{f.learners ? pct(f.avg) : '—'}</em>
                        </span>
                      </td>
                      <td data-label="Terminées">{f.done}</td>
                      <td data-label="Ventes">{f.revenue ? euro(f.revenue) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.section>

          <div className="st-grid3">
            <motion.section variants={itemVariants} className="st-card" aria-labelledby="st-sources">
              <h2 id="st-sources" className="st-title">Origine des accès</h2>
              <ul className="st-rows">
                {s.sources.map((src) => {
                  const share = s.enrollmentsCount ? src.value / s.enrollmentsCount : 0
                  return (
                    <li key={src.label}>
                      <span className="st-row-label">{src.label}</span>
                      <Meter value={share} label={`${src.label} : ${pct(share)}`} />
                      <span className="st-row-value">
                        <b>{src.value}</b> <em>{pct(share)}</em>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </motion.section>

            <motion.section variants={itemVariants} className="st-card" aria-labelledby="st-ateliers">
              <div className="st-head">
                <h2 id="st-ateliers" className="st-title">Ateliers à venir</h2>
                <CalendarDays size={18} aria-hidden="true" className="muted" />
              </div>
              {s.upcoming.length === 0 ? (
                <p className="small muted">Aucun atelier programmé.</p>
              ) : (
                <ul className="st-rows st-rows-stack">
                  {s.upcoming.map((w) => {
                    const booked = w.seatsLeft === null ? null : w.capacity - w.seatsLeft
                    return (
                      <li key={w.id}>
                        <Link to={`/admin/ateliers/${w.id}`} className="st-ws">
                          <span className="st-row-label">
                            <b>{formatDate(w.startsAt, { day: 'numeric', month: 'short' })}</b> {w.title}
                          </span>
                          {booked === null ? (
                            <span className="small muted">{w.capacity} places</span>
                          ) : (
                            <>
                              <Meter value={booked / w.capacity} label={`${booked} inscrits sur ${w.capacity}`} />
                              <span className="st-row-value">
                                <b>{booked}</b> <em>/ {w.capacity}</em>
                              </span>
                            </>
                          )}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </motion.section>

            <motion.section variants={itemVariants} className="st-card" aria-labelledby="st-parrainage">
              <div className="st-head">
                <h2 id="st-parrainage" className="st-title">Parrainage</h2>
                <Gift size={18} aria-hidden="true" className="muted" />
              </div>
              <div className="st-mini">
                <p>
                  <b>{s.referralsTotal}</b>
                  <span>filleul{s.referralsTotal > 1 ? 's' : ''} invité{s.referralsTotal > 1 ? 's' : ''}</span>
                </p>
                <p>
                  <b>{s.referralsPurchased}</b>
                  <span>ont acheté</span>
                </p>
                <p>
                  <b>{s.referralsTotal ? pct(s.referralsPurchased / s.referralsTotal) : '—'}</b>
                  <span>conversion</span>
                </p>
              </div>
              {s.topReferrers.length ? (
                <ol className="st-top">
                  {s.topReferrers.map((c) => (
                    <li key={c.profile.id}>
                      <span>
                        {c.profile.firstName} {c.profile.lastName}
                        {c.profile.company ? <em> · {c.profile.company}</em> : null}
                      </span>
                      <b>
                        {c.referralsPurchased}/{c.referralsTotal}
                      </b>
                    </li>
                  ))}
                </ol>
              ) : null}
            </motion.section>
          </div>

          <motion.section variants={itemVariants} className="st-card" aria-labelledby="st-latest">
            <div className="st-head">
              <h2 id="st-latest" className="st-title">Derniers inscrits</h2>
              <Link className="linkish small" to="/admin/clients">
                Tous les clients <ArrowRight size={14} aria-hidden="true" style={{ verticalAlign: -2 }} />
              </Link>
            </div>
            <ul className="st-latest">
              {s.latest.map((c) => (
                <li key={c.profile.id}>
                  <span className="st-latest-name">
                    <b>
                      {c.profile.firstName} {c.profile.lastName}
                    </b>
                    <em>{c.profile.company || c.profile.email}</em>
                  </span>
                  <span className="small muted">
                    {c.enrollments.length} accès · inscrit le {formatDate(c.profile.createdAt, { day: 'numeric', month: 'long' })}
                  </span>
                </li>
              ))}
            </ul>
          </motion.section>
        </motion.div>
      )}
    </Page>
  )
}
