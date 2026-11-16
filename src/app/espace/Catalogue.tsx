// À débloquer : les formations non possédées. Le plan est visible, le contenu reste flouté.
// Prix barré et nouveau prix dès qu'une réduction de parrainage s'applique, avec sa date d'expiration.
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { Check, Clock, Lock, PartyPopper, PlayCircle, FileText, AlignLeft } from 'lucide-react'
import { daysLeft, formatDate, formatEuro } from '../data/logic'
import type { Formation, LessonKind } from '../data/types'
import { useBackend, useClientData } from '../state'
import { Button, EmptyState, Modal, Page, Price, itemVariants, listVariants } from '../ui/kit'
import { useToast } from '../ui/toast'
import { PageSkeleton, plural, useQuote } from './common'

const KIND_ICON: Record<LessonKind, typeof FileText> = { video: PlayCircle, slides: FileText, text: AlignLeft }

/** Léger effet d'inclinaison 3D au survol (souris uniquement, désactivé si mouvement réduit). */
function Tilt({ children, className, id }: { children: ReactNode; className: string; id?: string }) {
  const ref = useRef<HTMLElement>(null)
  const [enabled] = useState(() => window.matchMedia('(hover: hover) and (pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const move = (e: RPointerEvent) => {
    const el = ref.current
    if (!el || !enabled) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    el.style.transform = `perspective(1400px) rotateX(${(-y * 2.4).toFixed(2)}deg) rotateY(${(x * 3).toFixed(2)}deg)`
  }
  const leave = () => {
    if (ref.current) ref.current.style.transform = ''
  }
  return (
    <motion.article ref={ref} id={id} className={className} variants={itemVariants} onPointerMove={move} onPointerLeave={leave}>
      {children}
    </motion.article>
  )
}

export function Catalogue() {
  const backend = useBackend()
  const { data, refresh } = useClientData()
  const priceFor = useQuote()
  const toast = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState<string | null>(null)
  const [demoPay, setDemoPay] = useState<{ f: Formation; price: number; final: number } | null>(null)
  const [confirming, setConfirming] = useState(false)

  // Ancre #slug (depuis le tableau de bord)
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (id && data) document.getElementById(id)?.scrollIntoView({ block: 'start' })
  }, [data])

  if (!data) return <PageSkeleton />
  const locked = data.formations.filter((f) => !data.enrollments.some((e) => e.formationId === f.id))

  const unlock = async (f: Formation) => {
    setBusy(f.id)
    try {
      const res = await backend.startCheckout(f.id)
      if (res.url) {
        window.location.assign(res.url)
        return
      }
      if (res.demo) setDemoPay({ f, price: res.demo.price, final: res.demo.finalPrice })
    } catch {
      toast('Le paiement n’a pas pu démarrer. Réessayez dans un instant.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const confirmDemo = async () => {
    if (!demoPay || !backend.confirmDemoPayment) return
    setConfirming(true)
    await backend.confirmDemoPayment(demoPay.f.id)
    await refresh()
    setConfirming(false)
    const slug = demoPay.f.slug
    setDemoPay(null)
    navigate(`/espace/merci?formation=${slug}`)
  }

  return (
    <Page kicker="À débloquer" title="La suite de votre parcours." sub="Chaque formation se suit à votre rythme, sur votre téléphone. Le programme est visible, le contenu se débloque.">
      {locked.length === 0 ? (
        <EmptyState icon={<PartyPopper />} title="Tout est débloqué" text="Vous avez accès à toutes les formations MJ FORM. Les prochaines arrivent bientôt." />
      ) : (
        <motion.div className="catalogue" variants={listVariants} initial="hidden" animate="show">
          {locked.map((f) => {
            const q = priceFor(f)
            const learners = data.learners[f.id] ?? 0
            const lessonsCount = f.modules.reduce((n, m) => n + m.lessons.filter((l) => l.status === 'published').length, 0)
            return (
              <Tilt key={f.id} id={f.slug} className="offer">
                <div className="offer-info">
                  <div className="row wrap" style={{ gap: 8 }}>
                    <span className="badge">{f.level}</span>
                    <span className="badge">
                      <Clock aria-hidden="true" /> {f.duration}
                    </span>
                  </div>
                  <h2 className="offer-title">{f.title}</h2>
                  <p className="muted" style={{ margin: 0 }}>
                    {f.description}
                  </p>
                  <ul className="benefits">
                    {f.benefits.map((b) => (
                      <li key={b}>
                        <Check aria-hidden="true" />
                        {b}
                      </li>
                    ))}
                  </ul>
                  {learners > 0 ? (
                    <p className="small muted" style={{ margin: 0 }}>
                      {plural(learners, 'commerçant du bassin de Thau a', 'commerçants du bassin de Thau ont')} suivi cette formation.
                    </p>
                  ) : null}
                  <div className="offer-buy">
                    <div>
                      <Price price={q.price} final={q.finalPrice} size="lg" />
                      {q.percent > 0 ? (
                        <p className="small" style={{ margin: '4px 0 0', color: 'var(--blue)', fontWeight: 500 }}>
                          {q.refereeDiscount
                            ? `Avantage filleul : -${q.percent} % sur votre première formation`
                            : `Votre réduction -${q.percent} % expire dans ${plural(daysLeft(q.expiresAt!), 'jour', 'jours')} (${formatDate(q.expiresAt!, { day: 'numeric', month: 'long' })})`}
                        </p>
                      ) : null}
                    </div>
                    <Button loading={busy === f.id} onClick={() => unlock(f)}>
                      Débloquer — {formatEuro(q.finalPrice)}
                    </Button>
                  </div>
                </div>
                <div className="offer-plan" aria-label={`Programme de ${f.title}`}>
                  <p className="small muted" style={{ margin: '0 0 12px' }}>
                    Programme · {plural(f.modules.length, 'module', 'modules')} · {plural(lessonsCount, 'leçon', 'leçons')}
                  </p>
                  <ol className="plan">
                    {[...f.modules]
                      .sort((a, b) => a.position - b.position)
                      .map((m) => (
                        <li key={m.id}>
                          <strong>{m.title}</strong>
                          <ul>
                            {m.lessons
                              .filter((l) => l.status === 'published')
                              .sort((a, b) => a.position - b.position)
                              .map((l) => {
                                const Icon = KIND_ICON[l.kind]
                                return (
                                  <li key={l.id}>
                                    <Icon aria-hidden="true" />
                                    <span>{l.title}</span>
                                    <Lock aria-label="Verrouillé" className="lock" />
                                  </li>
                                )
                              })}
                          </ul>
                        </li>
                      ))}
                  </ol>
                  <div className="locked-preview" aria-hidden="true">
                    <div className="locked-lines">
                      <span />
                      <span />
                      <span />
                    </div>
                    <span className="locked-badge">
                      <Lock /> Contenu verrouillé
                    </span>
                  </div>
                </div>
              </Tilt>
            )
          })}
        </motion.div>
      )}

      <Modal open={Boolean(demoPay)} onClose={() => !confirming && setDemoPay(null)} title="Paiement de démonstration">
        {demoPay ? (
          <div className="stack">
            <p className="muted" style={{ margin: 0 }}>
              En production, vous seriez redirigé vers la page de paiement sécurisée Stripe. Ici, aucun débit : le paiement est simulé.
            </p>
            <div className="panel soft row between">
              <span>{demoPay.f.title}</span>
              <Price price={demoPay.price} final={demoPay.final} />
            </div>
            <Button block loading={confirming} onClick={confirmDemo}>
              Confirmer le paiement test
            </Button>
          </div>
        ) : null}
      </Modal>
    </Page>
  )
}
