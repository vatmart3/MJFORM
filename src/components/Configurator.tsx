import { useEffect, useMemo, useState } from 'react'
import { CONTACT } from '../config'
import {
  FORMATS,
  LEVELS,
  ONLINE_SURCHARGE,
  SPECIAL,
  atelierById,
  ateliersOf,
  compareAtOf,
  formatPrice,
  hasOnline,
  priceOf,
  type FormatId,
  type LevelId,
} from '../data/ateliers'
import { PILOT_SESSION_ID, sessionById, upcomingSessions } from '../data/sessions'
import { scrollToTarget } from '../lib/motion'
import {
  fetchUpgradeQuote,
  formatDay,
  formatHours,
  slotsFor,
  startCheckout,
  useAvailability,
  type SessionSlot,
  type UpgradeQuote,
} from '../lib/sessions'
import { chosenFormat, selection, useStoreSelector } from '../lib/store'
import { Eyebrow, SplitTitle } from './ui'

const PILOT_SOURCES = ['flyer1', 'flyer2', 'flyer3']

function SeatsLeft({ slot }: { slot: SessionSlot }) {
  if (slot.seatsLeft == null) return null
  if (slot.seatsLeft === 0) return <span className="seats-left full">Complet</span>
  return (
    <span className="seats-left">
      {slot.seatsLeft === 1 ? 'Dernière place' : `${slot.seatsLeft} places restantes`}
    </span>
  )
}

const ERRORS: Record<string, string> = {
  full: 'Cette date vient d’être complétée. Choisissez une autre date.',
  'session-past': 'Cette date est passée. Choisissez une autre date.',
  'not-configured': `Le paiement en ligne n’est pas encore ouvert. Appelez-nous au ${CONTACT.phone} pour réserver.`,
  'price-missing': `Le paiement en ligne n’est pas encore ouvert. Appelez-nous au ${CONTACT.phone} pour réserver.`,
  'upgrade-used': 'Ce paiement a déjà servi à passer en présentiel.',
  'upgrade-invalid': 'Ce lien de passage au présentiel n’est pas valable pour cet atelier.',
}

const placesLeft = (n: number) => (n === 1 ? 'il reste 1 place' : `il reste ${n} places`)

export function Configurator() {
  const sel = useStoreSelector(selection, (s) => s)
  const format = useStoreSelector(chosenFormat, (f) => f)
  // Passage du format en ligne au présentiel (lien depuis l'espace stagiaire)
  const [upgrade, setUpgrade] = useState<{ from: string; quote: UpgradeQuote | null; error: string | null } | null>(null)
  const { availability, loading } = useAvailability()
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  const atelier = sel.atelierId ? atelierById(sel.atelierId) : undefined
  const level = sel.level
  const available = useMemo(() => (atelier ? slotsFor(atelier.id, availability) : []), [availability, atelier])
  const slot = available.find((s) => s.id === sel.sessionId)
  const pilot = sessionById(PILOT_SESSION_ID)!
  const pilotOpen = upcomingSessions().some((s) => s.id === PILOT_SESSION_ID)
  const online = format === 'online' && Boolean(atelier && hasOnline(atelier))
  const upgradeQuote = upgrade?.quote && upgrade.quote.atelierId === atelier?.id && format === 'presentiel' ? upgrade.quote : null
  const total = atelier ? (upgradeQuote ? upgradeQuote.final : priceOf(atelier, online ? 'online' : 'presentiel')) : 0
  // Prochaine date en présentiel avec des places (pour l'encart du format en ligne)
  const nextLive = available.find((s) => s.seatsLeft !== 0)

  // Flyers (utm_source=flyer1|flyer2|flyer3) ou ?pilote : l'atelier spécial fêtes est présélectionné
  // et la page s'ouvre directement sur la réservation.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const source = (params.get('utm_source') ?? '').toLowerCase()
    if (!pilotOpen || !(params.has('pilote') || PILOT_SOURCES.includes(source))) return
    selection.set({ level: 'special', atelierId: SPECIAL.id, sessionId: PILOT_SESSION_ID })
    const go = () => scrollToTarget('#reserver', -64, true)
    requestAnimationFrame(go)
    // Une fois l'écran de chargement retiré (polices chargées), on recale la position.
    window.addEventListener('mjform:ready', go, { once: true })
    return () => window.removeEventListener('mjform:ready', go)
  }, [pilotOpen])

  // Lien « Passez en présentiel » : ?upgrade=<paiement en ligne>&atelier=<id>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const from = params.get('upgrade')
    const a = atelierById(params.get('atelier') ?? '')
    if (!from || !a) return
    selection.set({ level: a.level, atelierId: a.id, sessionId: null })
    chosenFormat.set('presentiel')
    setUpgrade({ from, quote: null, error: null })
    if (from.startsWith('cs_demo_')) {
      // Espace de test : aucun paiement réel à vérifier, la déduction est calculée ici
      const paid = Math.max(0, Number(params.get('paid')) || 0)
      const price = priceOf(a, 'presentiel')
      setUpgrade({ from, quote: { atelierId: a.id, paid, price, final: Math.max(0, price - paid) }, error: null })
    } else
    fetchUpgradeQuote(from, a.id)
      .then((quote) => setUpgrade({ from, quote, error: null }))
      .catch((e) => setUpgrade({ from, quote: null, error: (e as Error).message }))
    const go = () => scrollToTarget('#reserver', -64, true)
    requestAnimationFrame(go)
    window.addEventListener('mjform:ready', go, { once: true })
    return () => window.removeEventListener('mjform:ready', go)
  }, [])

  // Une date pré-choisie n'est gardée que si elle est proposée pour l'atelier
  useEffect(() => {
    if (sel.sessionId && atelier && !slot) selection.set((s) => ({ ...s, sessionId: null }))
  }, [sel.sessionId, atelier, slot])

  // Une seule date possible (ex. atelier spécial) : elle est sélectionnée d'office
  useEffect(() => {
    if (atelier && !sel.sessionId && available.length === 1 && available[0].seatsLeft !== 0) {
      selection.set((s) => ({ ...s, sessionId: available[0].id }))
    }
  }, [atelier, sel.sessionId, available])

  const chooseLevel = (l: LevelId) => selection.set({ level: l, atelierId: null, sessionId: null })
  const chooseSpecial = () => selection.set({ level: 'special', atelierId: SPECIAL.id, sessionId: PILOT_SESSION_ID })
  const chooseAtelier = (id: string) => selection.set((s) => ({ ...s, atelierId: id, sessionId: null }))
  const chooseFormat = (f: FormatId) => chosenFormat.set(f)
  const chooseSlot = (id: string) => selection.set((s) => ({ ...s, sessionId: id }))

  const ready = Boolean(atelier && (online || (slot && slot.seatsLeft !== 0)))

  const pay = async () => {
    if (!atelier || !ready) return
    setPaying(true)
    setPayError(null)
    try {
      const url = await startCheckout(
        online
          ? { atelierId: atelier.id, format: 'online' }
          : { atelierId: atelier.id, format: 'presentiel', sessionId: slot!.id, upgradeFrom: upgradeQuote ? upgrade!.from : undefined },
      )
      window.location.assign(url)
    } catch (e) {
      const code = (e as Error).message
      setPayError(ERRORS[code] ?? `Le paiement n’a pas pu démarrer. Réessayez dans un instant ou appelez-nous au ${CONTACT.phone}.`)
      setPaying(false)
    }
  }

  const levelLabel = atelier ? (atelier.level === 'special' ? 'Atelier spécial' : LEVELS.find((l) => l.id === atelier.level)!.label) : ''

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
                <div className="lvl">{levelLabel}</div>
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
            {atelier ? (
              <div className="swap" key={'p' + atelier.id} style={{ marginTop: 32 }}>
                <div className="big-price">
                  {upgradeQuote ? (
                    <s className="strike">{formatPrice(upgradeQuote.price)}</s>
                  ) : compareAtOf(atelier, online ? 'online' : 'presentiel') ? (
                    <s className="strike">{formatPrice(compareAtOf(atelier, online ? 'online' : 'presentiel')!)}</s>
                  ) : null}
                  {formatPrice(total)}
                </div>
                {upgradeQuote ? <div className="when">Déjà payé en ligne : {formatPrice(upgradeQuote.paid)}, déduit.</div> : null}
                {atelier.priceNote ? <div className="when">{atelier.priceNote}</div> : null}
                <div className="when">
                  {online
                    ? 'En ligne · accès 12 mois, à votre rythme'
                    : slot
                      ? `${formatDay(slot.startsAt)} · ${formatHours(slot.session)} · Sète`
                      : 'Choisissez une date'}
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
                {pilotOpen ? (
                  <button type="button" role="radio" className="opt" aria-checked={level === 'special'} onClick={chooseSpecial}>
                    <span>
                      <span className="t">
                        {SPECIAL.name} · {SPECIAL.pitch.replace(/\.$/, '')}
                      </span>
                      <span className="s">
                        {formatDay(new Date(pilot.start))} · {formatHours(pilot)} · {pilot.capacity} places
                      </span>
                    </span>
                    <span className="p">
                      {formatPrice(SPECIAL.price)}
                      {SPECIAL.priceNote ? <span className="s">{SPECIAL.priceNote}</span> : null}
                    </span>
                  </button>
                ) : null}
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
                      {compareAtOf(a, format === 'online' && hasOnline(a) ? 'online' : 'presentiel') ? (
                        <s className="strike">{formatPrice(compareAtOf(a, format === 'online' && hasOnline(a) ? 'online' : 'presentiel')!)}</s>
                      ) : null}
                      {formatPrice(priceOf(a, format === 'online' && hasOnline(a) ? 'online' : 'presentiel'))}
                      {a.priceNote ? <span className="s">{a.priceNote}</span> : null}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Format */}
            <div className="cstep" aria-disabled={!atelier}>
              <h3>
                <span className="n">3.</span>Quel format ?
              </h3>
              <div className="options" role="radiogroup" aria-label="Format">
                {(['presentiel', 'online'] as const).map((f) => {
                  const unavailable = f === 'online' && atelier != null && !hasOnline(atelier)
                  return (
                    <button
                      key={f}
                      type="button"
                      role="radio"
                      className="opt"
                      aria-checked={(online ? 'online' : 'presentiel') === f}
                      onClick={() => chooseFormat(f)}
                      disabled={!atelier || unavailable}
                    >
                      <span>
                        <span className="t">
                          {FORMATS[f].label}
                          {f === 'presentiel' ? <span className="reco">Recommandé</span> : null}
                        </span>
                        <span className="s">{unavailable ? 'Cet atelier se suit uniquement en présentiel.' : FORMATS[f].tagline}</span>
                      </span>
                      <span className="p">
                        {atelier ? (unavailable ? '—' : formatPrice(priceOf(atelier, f))) : f === 'online' ? `+${ONLINE_SURCHARGE} €` : ''}
                      </span>
                    </button>
                  )
                })}
              </div>
              {online && nextLive ? (
                <div className="nudge" role="note">
                  <p>
                    Pour {ONLINE_SURCHARGE} € de moins, venez en présentiel le {formatDay(nextLive.startsAt)}
                    {nextLive.seatsLeft != null ? ` — ${placesLeft(nextLive.seatsLeft)}.` : '.'}
                  </p>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => chooseFormat('presentiel')}>
                    Choisir le présentiel
                  </button>
                </div>
              ) : null}
            </div>

            {/* 4. Date (présentiel uniquement) */}
            {online ? null : (
            <div className="cstep" aria-disabled={!atelier}>
              <h3>
                <span className="n">4.</span>Quelle date ?
              </h3>
              {atelier?.pack ? (
                <p className="muted" style={{ margin: '-6px 0 14px', fontSize: 15 }}>
                  Choisissez la date de votre premier atelier. Les suivantes sont fixées ensemble.
                </p>
              ) : null}
              <div className="options" role="radiogroup" aria-label="Date">
                {atelier && available.length === 0 ? (
                  <p className="muted">Les prochaines dates de cet atelier arrivent bientôt. Appelez-nous pour être prévenu.</p>
                ) : (
                  (atelier ? available : slotsFor(ateliersOf('n1')[0].id, null)).map((s) => {
                    const full = s.seatsLeft === 0
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
                          <span className="s">{formatHours(s.session)} · Sète</span>
                        </span>
                        <span className="p">{loading && atelier ? null : <SeatsLeft slot={s} />}</span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
            )}

            {/* Paiement */}
            <div className="config-pay">
              <div className="total">
                <span>Total</span>
                <span>{atelier ? formatPrice(total) : '—'}</span>
              </div>
              <button className="btn btn-primary" type="button" disabled={!ready || paying} onClick={pay}>
                {paying
                  ? 'Ouverture du paiement…'
                  : ready
                    ? total === 0
                      ? 'Confirmer ma place'
                      : `Payer ${formatPrice(total)}`
                    : 'Choisissez votre atelier et la date'}
              </button>
              {upgrade?.error ? (
                <p className="error" role="alert">
                  {ERRORS[upgrade.error] ?? `La déduction n’a pas pu être calculée. Appelez-nous au ${CONTACT.phone}, nous l’appliquons à la main.`}
                </p>
              ) : null}
              {payError ? (
                <p className="error" role="alert">
                  {payError}
                </p>
              ) : null}
              <p className="fine">
                {online
                  ? 'Paiement sécurisé par Stripe. Prix nets, TVA non applicable (art. 293 B du CGI). Accès ouvert dès le paiement, pendant 12 mois.'
                  : 'Paiement sécurisé par Stripe. Prix nets, TVA non applicable (art. 293 B du CGI). Annulation 7 jours ou plus avant : remboursement intégral ; moins de 7 jours : report gratuit.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
