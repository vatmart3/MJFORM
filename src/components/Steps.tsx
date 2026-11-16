import { Eyebrow, SectionCta, SplitTitle } from './ui'

const STEPS = [
  { n: '01', t: 'Vous réservez', d: 'Un niveau, un atelier, une date. Paiement sécurisé. Moins d’une minute.' },
  { n: '02', t: 'Vous venez avec votre téléphone', d: 'Et vos accès. Pas besoin d’ordinateur pour le niveau 1.' },
  { n: '03', t: 'Vous repartez avec vos résultats', d: 'Avis répondus, publications prêtes, modèles en place. Pas des notes.' },
  { n: '04', t: 'On vous suit pendant 14 jours', d: 'Une question, un blocage ? Un message suffit.' },
]

export function Steps() {
  return (
    <section className="section" id="deroulement" aria-labelledby="steps-title">
      <div className="wrap">
        <div className="head">
          <Eyebrow>Comment ça se passe</Eyebrow>
          <SplitTitle first="Quatre étapes." second="Zéro surprise." id="steps-title" />
        </div>
        <ol className="steps" data-stagger="" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {STEPS.map((s) => (
            <li key={s.n} className="card step">
              <div className="num">{s.n}</div>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </li>
          ))}
        </ol>
        <SectionCta />
      </div>
    </section>
  )
}
