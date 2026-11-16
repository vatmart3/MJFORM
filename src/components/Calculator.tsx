import { useEffect, useRef, useState } from 'react'
import { gsap, prefersReducedMotion } from '../lib/motion'
import { BookLink, Eyebrow, SplitTitle } from './ui'

/*
  Hypothèses affichées en clair sous le résultat :
  — réseaux : la méthode de l'atelier tient en 20 minutes par semaine ;
  — administratif : l'IA fait le premier jet, vous gagnez la moitié du temps ;
  — avis : 5 minutes pour répondre seul, 1 minute en relisant une réponse préparée.
*/
const WEEKS_PER_MONTH = 52 / 12
const SOCIAL_KEEP_H = 20 / 60
const ADMIN_SHARE = 0.5
const REVIEW_SAVED_MIN = 4

function compute(social: number, admin: number, reviews: number) {
  const socialSaved = Math.max(0, social - SOCIAL_KEEP_H) * WEEKS_PER_MONTH
  const adminSaved = admin * ADMIN_SHARE * WEEKS_PER_MONTH
  const reviewsSaved = (reviews * REVIEW_SAVED_MIN) / 60
  return Math.max(1, Math.round(socialSaved + adminSaved + reviewsSaved))
}

function Range({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit: (v: number) => string
  onChange: (v: number) => void
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="range-row">
      <label htmlFor={id}>
        <span>{label}</span>
        <output htmlFor={id}>{unit(value)}</output>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ ['--p' as string]: `${pct}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={unit(value)}
      />
    </div>
  )
}

export function Calculator() {
  const [social, setSocial] = useState(4)
  const [admin, setAdmin] = useState(5)
  const [reviews, setReviews] = useState(10)
  const hours = compute(social, admin, reviews)
  const out = useRef<HTMLSpanElement>(null)
  const shown = useRef(hours)

  // Compteur animé (ressort) — direct si le mouvement est réduit
  useEffect(() => {
    const el = out.current
    if (!el) return
    if (prefersReducedMotion()) {
      el.textContent = String(hours)
      shown.current = hours
      return
    }
    const obj = { v: shown.current }
    const tween = gsap.to(obj, {
      v: hours,
      duration: 0.9,
      ease: 'expo.out',
      onUpdate: () => {
        shown.current = obj.v
        el.textContent = String(Math.round(obj.v))
      },
    })
    return () => {
      tween.kill()
    }
  }, [hours])

  const days = Math.round((hours / 7) * 2) / 2

  return (
    <section className="section gray" id="temps" aria-labelledby="temps-title">
      <div className="wrap">
        <div className="head">
          <Eyebrow>Calculateur</Eyebrow>
          <SplitTitle first="Le temps que" second="vous récupérez." id="temps-title" />
        </div>
        <div className="calc">
          <div className="card calc-inputs" data-reveal="">
            <Range
              id="r-social"
              label="Heures par semaine sur les réseaux"
              value={social}
              min={1}
              max={15}
              unit={(v) => `${v} h`}
              onChange={setSocial}
            />
            <Range
              id="r-admin"
              label="Heures par semaine sur l’administratif"
              value={admin}
              min={1}
              max={20}
              unit={(v) => `${v} h`}
              onChange={setAdmin}
            />
            <Range
              id="r-reviews"
              label="Avis Google reçus par mois"
              value={reviews}
              min={1}
              max={60}
              unit={(v) => `${v} avis`}
              onChange={setReviews}
            />
          </div>
          <div className="card calc-result" data-reveal="" data-reveal-delay="0.1" aria-live="polite">
            <div className="big">
              <span ref={out}>{hours}</span>
            </div>
            <div className="unit">heures récupérées par mois</div>
            <p className="sub">
              Soit environ {String(days).replace('.', ',')} {days > 1 ? 'journées' : 'journée'} de 7 heures.
            </p>
            <BookLink className="btn btn-primary" magnetic="0.3">
              Récupérer ce temps
            </BookLink>
            <p className="calc-hyp">
              Estimation indicative. Hypothèses : réseaux tenus en 20 minutes par semaine, administratif divisé par deux,
              4 minutes gagnées par avis.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
