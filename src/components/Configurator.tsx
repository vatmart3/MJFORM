import { useEffect, useMemo, useState } from 'react'
import { CONTACT } from '../config'
import { LEVELS, atelierById, ateliersOf, formatPrice, type LevelId } from '../data/ateliers'
import { formatDay, formatTime, slotsFor, startCheckout, useSessions, type SessionSlot } from '../lib/sessions'
import { selection, useStoreSelector } from '../lib/store'
import { Eyebrow, SplitTitle } from './ui'

function priceFor(atelierId: string, slot: SessionSlot | undefined) {
  const a = atelierById(atelierId)!
  // Un prix de session (ex. lancement) ne s'applique qu'à l'atelier seul, jamais aux packs.
  if (!a.pack && slot?.priceOverride != null && slot.atelierId === a.id) {
    return { price: slot.priceOverride, compareAt: a.price }
  }
  return { price: a.price, compareAt: a.compareAt }
}

function SeatsLeft({ slot }: { slot: SessionSlot }) {
  if (slot.seatsLeft == null) return null
  if (slot.seatsLeft === 0) return <span className="seats-left full">Complet</span>
  return (
    <span className="seats-left">
      {slot.seatsLeft === 1 ? 'Dernière place' : `${slot.seatsLeft} places restantes`}
    </span>
  )
}

export function Configurator() {
  const sel = useStoreSelector(selection, (s) => s)
  const { slots, loading, error } = useSessions()
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  const atelier = sel.atelierId ? atelierById(sel.atelierId) : undefined
  const level = sel.level
  const available = useMemo(() => (atelier ? slotsFor(slots, atelier.id) : []), [slots, atelier])
  const slot = available.find((s) => s.id === sel.sessionId)

  // Une session pré-choisie (bandeau) n'est gardée que si elle correspond à l'atelier
  useEffect(() => {
    if (sel.sessionId && !loading && atelier && !slot) selection.set((s) => ({ ...s, sessionId: null }))
  }, [sel.sessionId, loading, atelier, slot])

  // Depuis le bandeau : on pré-sélectionne la première session à prix spécial de l'atelier
  useEffect(() => {
    if (!atelier || sel.sessionId || loading) return
    const special = available.find((s) => s.priceOverride != null && (s.seatsLeft ?? 1) > 0)
    if (special && atelier.id === special.atelierId) {
      selection.set((s) => ({ ...s, sessionId: special.id }))
    }
  }, [atelier?.id, loading])

  const chooseLevel = (l: LevelId) => selection.set({ level: l, atelierId: null, sessionId: null })
  const chooseAtelier = (id: string) => selection.set((s) => ({ ...s, atelierId: id, sessionId: null }))
  const chooseSlot = (id: string) => selection.set((s) => ({ ...s, sessionId: id }))

  const pricing = atelier ? priceFor(atelier.id, slot) : null
  const ready = Boolean(atelier && slot && slot.bookable && (slot.seatsLeft ?? 0) > 0)

  const pay = async () => {
    if (!atelier || !slot) return
    setPaying(true)
    setPayError(null)
    try {
      const url = await startCheckout(slot.id, atelier.id)
      window.location.assign(url)
    } catch (e) {
      const code = (e as Error).message
      setPayError(
        code === 'full'
          ? 'Cette session vient d’être complétée. Choisissez une autre date.'
          : 'Le paiement n’a pas pu démarrer. Réessayez dans un instant ou contactez-nous.',
      )
      setPaying(false)
    }
  }

  const mailto = useMemo(() => {
    if (!CONTACT.email || !atelier || !slot) return null
    const subject = `Réservation · ${atelier.name}`
    const body = `Bonjour,\n\nJe souhaite réserver une place pour « ${atelier.name} » le ${formatDay(slot.startsAt)} à ${formatTime(slot.startsAt)}.\n\nNom :\nCommerce :\nTéléphone :\n`
    return `mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }, [atelier, slot])

  return (
    <section className="section gray" id="reserver" aria-labelledby="reserver-title">
      <div className="wrap">
        <div className="head">
          <Eyebrow>Réservation</Eyebrow>
          <SplitTitle first="Votre place." second="En moins d’une minute." id="reserver-title" />
        </div>

        <div className="config">
          {/* Récapitulatif visuel, façon page d'achat */}
          <aside className={`config-visual${atelier ? '' : ' empty'}`} aria-live="polite">
            {atelier ? (
              <div className="swap" key={atelier.id + (slot?.id ?? '')}>
                <div className="lvl">{LEVELS.find((l) => l.id === atelier.level)!.label}</div>
                <h3>{atelier.name}</h3>
                <p className="muted" style={{ margin: '8px 0 0' }}>
                  {atelier.duration} · {atelier.pitch}
                </p>
                <p className="takeaways-label">Ce que vous emportez</p>
                <ul className="takeaways">
                  {atelier.takeaways.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="swap" key="empty">
                <div className="lvl">Atelier IA à Sète</div>
                <h3>Choisissez. On s’occupe du reste.</h3>
                <p className="muted" style={{ margin: '12px 0 0' }}>
                  Un niveau, un atelier, une date. Le paiement se fait sur la page sécurisée de Stripe.
                </p>
              </div>
            )}
            {pricing ? (
              <div className="swap" key={'p' + pricing.price} style={{ marginTop: 32 }}>
                <div className="big-price">
                  {pricing.compareAt ? <s className="strike">{formatPrice(pricing.compareAt)}</s> : null}
                  {formatPrice(pricing.price)}
                </div>
                <div className="when">
                  {slot ? `${formatDay(slot.startsAt)} · ${formatTime(slot.startsAt)} · Sète` : 'Choisissez une date'}
                </div>
              </div>
            ) : null}
          </aside>

          <div className="config-steps">
            {/* 1. Niveau */}
            <div className="cstep">
              <h3>
                <span className="n">1.</span>Quel niveau ?
              </h3>
              <div className="options" role="radiogroup" aria-label="Niveau">
                {LEVELS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    role="radio"
                    className="opt"
                    aria-checked={level === l.id}
                    onClick={() => chooseLevel(l.id)}
                  >
                    <span>
                      <span className="t">
                        {l.label} · {l.name}
                      </span>
                      <span className="s">{l.tagline}</span>
                    </span>
                    <span className="p">
                      Dès {formatPrice(Math.min(...ateliersOf(l.id).map((a) => a.price)))}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Atelier */}
            <div className="cstep" aria-disabled={!level}>
              <h3>
                <span className="n">2.</span>Quel atelier ?
              </h3>
              <div className="options" role="radiogroup" aria-label="Atelier">
                {(level ? ateliersOf(level) : ateliersOf('n1')).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    role="radio"
                    className="opt"
                    aria-checked={atelier?.id === a.id}
                    onClick={() => chooseAtelier(a.id)}
                    disabled={!level}
                  >
                    <span>
                      <span className="t">{a.name}</span>
                      <span className="s">{a.duration}</span>
                    </span>
                    <span className="p">
                      {a.compareAt ? <s className="strike">{formatPrice(a.compareAt)}</s> : null}
                      {formatPrice(a.price)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Date */}
            <div className="cstep" aria-disabled={!atelier}>
              <h3>
                <span className="n">3.</span>Quelle date ?
              </h3>
              {atelier?.pack ? (
                <p className="muted" style={{ margin: '-6px 0 14px', fontSize: 15 }}>
                  Choisissez la date de votre premier atelier. Les suivantes sont fixées ensemble.
                </p>
              ) : null}
              <div className="options" role="radiogroup" aria-label="Date">
                {loading ? (
                  <>
                    <div className="skeleton" />
                    <div className="skeleton" />
                  </>
                ) : error ? (
                  <p className="muted">Les dates n’ont pas pu être chargées. Rechargez la page ou contactez-nous.</p>
                ) : atelier && available.length === 0 ? (
                  <p className="muted">Les prochaines dates de cet atelier arrivent bientôt. Écrivez-nous pour être prévenu.</p>
                ) : (
                  (atelier ? available : slots.slice(0, 2)).map((s) => {
                    const full = s.seatsLeft === 0
                    const p = atelier ? priceFor(atelier.id, s) : null
                    const other = atelier?.pack && s.atelierId !== '*' ? atelierById(s.atelierId)?.name : null
                    return (
                      <button
                        key={s.id}
                        type="button"
                        role="radio"
                        className="opt"
                        aria-checked={slot?.id === s.id}
                        aria-disabled={full}
                        disabled={full || !atelier}
                        onClick={() => chooseSlot(s.id)}
                      >
                        <span>
                          <span className="t">{formatDay(s.startsAt)}</span>
                          <span className="s">
                            {formatTime(s.startsAt)} · Sète{other ? ` · ${other}` : ''}
                          </span>
                        </span>
                        <span className="p">
                          {p && p.price !== atelier!.price ? (
                            <>
                              <s className="strike">{formatPrice(atelier!.price)}</s>
                              {formatPrice(p.price)}
                              <br />
                            </>
                          ) : null}
                          <SeatsLeft slot={s} />
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            {/* Paiement */}
            <div className="config-pay">
              <div className="total">
                <span>Total</span>
                <span>{pricing ? formatPrice(pricing.price) : '—'}</span>
              </div>
              {slot && !slot.bookable ? (
                mailto ? (
                  <a className="btn btn-primary" href={mailto}>
                    Demander ma place
                  </a>
                ) : (
                  <button className="btn btn-primary" type="button" disabled>
                    Réservation en ligne bientôt disponible
                  </button>
                )
              ) : (
                <button className="btn btn-primary" type="button" disabled={!ready || paying} onClick={pay}>
                  {paying ? 'Ouverture du paiement…' : ready ? `Payer ${formatPrice(pricing!.price)}` : 'Choisissez votre atelier et la date'}
                </button>
              )}
              {payError ? (
                <p className="error" role="alert">
                  {payError}
                </p>
              ) : null}
              <p className="fine">
                Paiement sécurisé par Stripe. Remboursé si vous annulez 7 jours ou plus avant, reporté en deçà.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
