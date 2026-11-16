import { scrollToTarget } from '../lib/motion'
import { BookLink } from './ui'

/** Mots animés en CSS pur (pas d'attente du JavaScript : bon pour le LCP). */
function In({ text, start }: { text: string; start: number }) {
  return (
    <>
      {text.split(' ').map((w, i, arr) => (
        <span key={i}>
          <span className="in" style={{ ['--i' as string]: start + i }}>
            {w}
          </span>
          {i < arr.length - 1 ? ' ' : ''}
        </span>
      ))}
    </>
  )
}

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="wrap">
        <p className="eyebrow">
          <span className="in" style={{ ['--i' as string]: 0 }}>
            Ateliers IA à Sète
          </span>
        </p>
        <h1 className="display" id="hero-title">
          <span className="line">
            <In text="Votre commerce." start={1} />
          </span>{' '}
          <span className="line">
            <In text="Augmenté par l’IA." start={3} />
          </span>
        </h1>
        <p className="lead">
          <span className="in" style={{ ['--i' as string]: 6 }}>
            3 heures. Votre téléphone. Des résultats dès le lendemain matin.
          </span>
        </p>
        <div className="hero-ctas">
          <span className="in" style={{ ['--i' as string]: 7 }}>
            <BookLink className="btn btn-primary">
              Réserver ma place
            </BookLink>
          </span>
          <span className="in" style={{ ['--i' as string]: 8 }}>
            <a
              className="btn btn-secondary"
              href="#ateliers"
             
              onClick={(e) => {
                e.preventDefault()
                scrollToTarget('#ateliers')
              }}
            >
              Voir les ateliers
            </a>
          </span>
        </div>
        <p className="hero-meta">
          <span className="in" style={{ ['--i' as string]: 9 }}>
            <span>8 personnes par groupe</span>
            <span>Vendredi 18 h 30 ou lundi 19 h</span>
            <span>Suivi 14 jours</span>
          </span>
        </p>
      </div>
    </section>
  )
}
