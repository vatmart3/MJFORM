// Tableau de bord : reprise de la formation en cours (CTA principal), indicateurs,
// prochain atelier (places réelles) et formation recommandée.
import { Suspense, lazy, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { ArrowRight, CalendarDays, Lock, MapPin, Sparkles } from 'lucide-react'
import { activeRewards, daysLeft, formatDate, formationProgress, resumeLesson, sortForResume } from '../data/logic'
import type { Workshop } from '../data/types'
import { useBackend, useClientData, useSession } from '../state'
import { Button, Counter, EmptyState, ProgressBar, ProgressRing, itemVariants, listVariants } from '../ui/kit'
import { PageSkeleton, plural, useQuote } from './common'
import { AccessNotes } from './Access'

const Logo3D = lazy(() => import('./Logo3D'))
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function Dashboard() {
  const { user } = useSession()
  const backend = useBackend()
  const { data } = useClientData()
  const priceFor = useQuote()
  const navigate = useNavigate()
  const [workshop, setWorkshop] = useState<Workshop | null | undefined>(undefined)

  useEffect(() => {
    backend.nextWorkshop().then(setWorkshop).catch(() => setWorkshop(null))
  }, [backend])

  if (!data || !user) return <PageSkeleton />

  const owned = sortForResume(data.formations, data.enrollments, data.progress)
  const current = owned[0] ?? null
  const currentP = current ? formationProgress(current, data.progress) : null
  const next = current ? resumeLesson(current, data.progress) : null
  const nextModule = current && next ? current.modules.find((m) => m.id === next.moduleId) : null

  const allP = owned.map((f) => formationProgress(f, data.progress))
  const total = allP.reduce((s, p) => s + p.total, 0)
  const done = allP.reduce((s, p) => s + p.completed, 0)
  const globalPct = total ? Math.round((done / total) * 100) : 0
  const reward = activeRewards(data.rewards)[0] ?? null
  const purchased = data.referrals.filter((r) => r.status === 'purchased').length

  const recommended = data.formations.find((f) => !data.enrollments.some((e) => e.formationId === f.id)) ?? null
  const recQuote = recommended ? priceFor(recommended) : null
  const fromWorkshop = current ? data.enrollments.find((e) => e.formationId === current.id)?.source === 'workshop' : false

  return (
    <motion.div variants={listVariants} initial="hidden" animate="show">
      <motion.header variants={itemVariants} className="page-head dash-head">
        <div>
          <p className="kicker">{user.company || 'Votre espace MJ FORM'}</p>
          <h1 className="page-title">Bonjour {user.firstName}.</h1>
        </div>
      </motion.header>

      {current && currentP && next ? (
        <motion.section variants={itemVariants} className="resume" aria-labelledby="resume-title">
          <div className="resume-body">
            <p className="kicker">{currentP.completed > 0 ? 'Formation en cours' : 'À commencer'}</p>
            <h2 id="resume-title" className="resume-title">
              {current.title}
            </h2>
            <p className="muted" style={{ margin: '6px 0 20px' }}>
              Prochaine leçon : <strong style={{ color: 'var(--ink)' }}>{next.title}</strong>
              {nextModule ? ` · ${nextModule.title}` : ''}
            </p>
            <div className="row" style={{ gap: 16, marginBottom: 24 }}>
              <ProgressRing value={currentP.ratio} size={56} stroke={5} label={`${Math.round(currentP.ratio * 100)} % de la formation terminée`}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{Math.round(currentP.ratio * 100)}%</span>
              </ProgressRing>
              <div className="small">
                <strong>
                  {currentP.completed} {currentP.completed > 1 ? 'étapes' : 'étape'} sur {currentP.total}
                </strong>
                <div className="muted">{fromWorkshop ? 'L’atelier en présentiel compte déjà.' : 'Chaque leçon prend environ 15 minutes.'}</div>
              </div>
            </div>
            <Button onClick={() => navigate(`/espace/formations/${current.slug}/${next.id}`)}>
              Reprendre là où je me suis arrêté
              <ArrowRight aria-hidden="true" />
            </Button>
          </div>
          <div className="resume-art">
            <Suspense fallback={<div className="logo3d" />}>
              <Logo3D />
            </Suspense>
          </div>
        </motion.section>
      ) : (
        <motion.div variants={itemVariants}>
          <EmptyState
            icon={<Sparkles />}
            title="Aucune formation pour l’instant"
            text="Commencez par l’atelier d’initiation : 3 heures, votre téléphone, des résultats dès le lendemain."
            action={
              <Link className="btn btn-primary" to="/espace/catalogue">
                Découvrir l’atelier d’initiation
              </Link>
            }
          />
        </motion.div>
      )}

      <motion.div variants={itemVariants}>
        <AccessNotes enrollments={data.enrollments} formations={data.formations} />
      </motion.div>

      <motion.dl variants={itemVariants} className="figures" aria-label="Vos indicateurs">
        <div>
          <dt>Formations suivies</dt>
          <dd>
            <Counter value={owned.length} />
          </dd>
        </div>
        <div>
          <dt>Progression globale</dt>
          <dd>
            <Counter value={globalPct} suffix=" %" />
          </dd>
        </div>
        <div>
          <dt>Filleuls ayant acheté</dt>
          <dd>
            <Counter value={purchased} />
          </dd>
        </div>
        <div>
          <dt>Réduction disponible</dt>
          <dd>{reward ? (reward.kind === 'free' ? 'Offerte' : `-${reward.percent} %`) : '—'}</dd>
          {reward ? <span className="tiny muted">Expire dans {plural(daysLeft(reward.expiresAt), 'jour', 'jours')}</span> : null}
        </div>
      </motion.dl>

      <div className="dash-grid">
        <motion.section variants={itemVariants} className="panel" aria-labelledby="ws-title">
          <h2 id="ws-title" className="section-title row" style={{ gap: 8 }}>
            <CalendarDays size={20} aria-hidden="true" style={{ color: 'var(--blue)' }} />
            Prochain atelier
          </h2>
          {workshop === undefined ? (
            <div className="skel" style={{ height: 72 }} />
          ) : workshop ? (
            <>
              <p style={{ margin: 0, fontWeight: 600 }}>{workshop.title}</p>
              <p className="muted small" style={{ margin: '4px 0 0' }}>
                {capitalize(formatDate(workshop.startsAt, { weekday: 'long', day: 'numeric', month: 'long' }))} ·{' '}
                {formatDate(workshop.startsAt, { hour: '2-digit', minute: '2-digit' }).replace(':', ' h ')}
              </p>
              <p className="muted small row" style={{ gap: 4, margin: '4px 0 0' }}>
                <MapPin size={14} aria-hidden="true" /> {workshop.location}
              </p>
              <div className="row between" style={{ marginTop: 16 }}>
                {workshop.seatsLeft != null ? (
                  <span className={`badge${workshop.seatsLeft <= 3 ? ' blue' : ''}`}>
                    {workshop.seatsLeft === 0 ? 'Complet' : `${plural(workshop.seatsLeft, 'place restante', 'places restantes')}`}
                  </span>
                ) : (
                  <span />
                )}
                {workshop.seatsLeft !== 0 ? (
                  <a className="link-arrow small" href={workshop.bookingUrl}>
                    Réserver
                  </a>
                ) : null}
              </div>
            </>
          ) : (
            <p className="muted small" style={{ margin: 0 }}>
              Les prochaines dates arrivent bientôt.
            </p>
          )}
        </motion.section>

        <motion.section variants={itemVariants} className="panel" aria-labelledby="next-title">
          <h2 id="next-title" className="section-title row" style={{ gap: 8 }}>
            <Lock size={20} aria-hidden="true" style={{ color: 'var(--blue)' }} />
            Débloquez la suite
          </h2>
          {recommended && recQuote ? (
            <>
              <p style={{ margin: 0, fontWeight: 600 }}>{recommended.title}</p>
              <p className="muted small" style={{ margin: '4px 0 0' }}>
                {recommended.level} · {recommended.duration} · {recommended.subtitle}
              </p>
              <div style={{ margin: '14px 0 0' }}>
                <ProgressBar value={0} label={`${recommended.title} : pas encore commencée`} />
              </div>
              <div className="row between" style={{ marginTop: 16 }}>
                <span className="row" style={{ gap: 8, alignItems: 'baseline' }}>
                  {recQuote.finalPrice < recQuote.price ? (
                    <s className="muted small">{recQuote.price} €</s>
                  ) : null}
                  <strong style={{ fontFamily: 'var(--font-heading)', fontSize: 18 }}>
                    {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: recQuote.finalPrice % 1 ? 2 : 0 }).format(recQuote.finalPrice)}
                  </strong>
                </span>
                <Link className="link-arrow small" to={`/espace/catalogue#${recommended.slug}`}>
                  Voir le programme
                </Link>
              </div>
            </>
          ) : (
            <p className="muted small" style={{ margin: 0 }}>
              Vous avez débloqué toutes les formations. Bravo.
            </p>
          )}
        </motion.section>
      </div>
    </motion.div>
  )
}
