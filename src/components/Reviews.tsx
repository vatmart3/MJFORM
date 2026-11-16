import { Eyebrow, SplitTitle } from './ui'

/*
  EMPLACEMENTS À REMPLACER PAR DE VRAIS AVIS.
  Aucun avis n'est inventé. Remplacez chaque carte par un avis réel (prénom, commerce, ville)
  avec l'accord écrit de son auteur.
*/
export function Reviews() {
  return (
    <section className="section" id="avis" aria-labelledby="avis-title">
      <div className="wrap">
        <div className="head">
          <Eyebrow>Ils en parlent</Eyebrow>
          <SplitTitle first="Leurs mots." second="Pas les nôtres." id="avis-title" />
        </div>
        <div className="reviews" data-stagger="">
          {[1, 2, 3].map((i) => (
            <figure key={i} className="card review-slot" style={{ margin: 0 }}>
              <span className="tag">À REMPLACER PAR DE VRAIS AVIS</span>
              <div className="lines" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <figcaption className="who">Prénom · Commerce · Ville</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
