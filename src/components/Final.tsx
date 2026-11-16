import { CONTACT, telHref } from '../config'
import { BookLink, Eyebrow, SplitTitle } from './ui'

export function FinalCta() {
  const { phone, email } = CONTACT
  return (
    <section className="section gray final" id="contact" aria-labelledby="final-title">
      <div className="wrap wrap-text">
        <Eyebrow>Contact</Eyebrow>
        <SplitTitle first="Parlons de" second="votre commerce." id="final-title" />
        <p className="lead" data-reveal="">
          Une question avant de réserver ? Un besoin précis ? On vous répond, simplement.
        </p>
        <div className="contacts" data-reveal="">
          {phone ? (
            <div>
              <span className="k">Téléphone</span>
              <a className="link-arrow" href={telHref(phone)}>
                {phone}
              </a>
            </div>
          ) : null}
          {email ? (
            <div>
              <span className="k">E-mail</span>
              <a className="link-arrow" href={`mailto:${email}`}>
                {email}
              </a>
            </div>
          ) : null}
          {!phone || !email ? (
            import.meta.env.DEV ? (
              <p className="todo-note">
                À compléter : renseignez VITE_CONTACT_PHONE et VITE_CONTACT_EMAIL dans le fichier .env
              </p>
            ) : null
          ) : null}
        </div>
        <div className="hero-ctas" data-reveal="">
          <BookLink className="btn btn-primary">
            Réserver ma place
          </BookLink>
        </div>
      </div>
    </section>
  )
}
