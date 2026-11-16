import { CONTACT } from '../config'
import { BookLink, Eyebrow, SplitTitle } from './ui'

export function FinalCta() {
  return (
    <section className="section gray final" id="contact" aria-labelledby="final-title">
      <div className="wrap wrap-text">
        <Eyebrow>Contact</Eyebrow>
        <SplitTitle first="Parlons de" second="votre commerce." id="final-title" />
        <p className="lead" data-reveal="">
          Une question avant de réserver ? Un besoin précis ? On vous répond, simplement.
        </p>
        <div className="hero-ctas" data-reveal="">
          <a className="btn btn-secondary" href={CONTACT.tel}>
            Appeler
          </a>
          <a className="btn btn-secondary" href={CONTACT.whatsapp} target="_blank" rel="noopener">
            WhatsApp
          </a>
          <a className="btn btn-secondary" href={`mailto:${CONTACT.email}`}>
            E-mail
          </a>
        </div>
        <p className="hero-meta" data-reveal="">
          <span>{CONTACT.phone}</span>
          <span>{CONTACT.email}</span>
        </p>
        <div className="hero-ctas" data-reveal="">
          <BookLink className="btn btn-primary">Réserver ma place</BookLink>
        </div>
      </div>
    </section>
  )
}
