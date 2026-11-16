import { GROUP_SIZE } from '../config'
import { Eyebrow, Icon, SectionCta, SplitTitle } from './ui'

export function Groups() {
  return (
    <section className="section gray" id="groupes" aria-labelledby="groups-title">
      <div className="wrap">
        <div className="head">
          <Eyebrow>Le format</Eyebrow>
          <SplitTitle first="8 personnes." second="2 formateurs." id="groups-title" />
          <p className="lead" data-reveal="">
            Assez petit pour que chacun avance sur son commerce. Assez grand pour apprendre des autres.
          </p>
        </div>
        <div className="group-grid" data-stagger="">
          <div className="card seats-card">
            <div className="feature">
              <Icon name="group" />
              <h3>Un formateur pour quatre.</h3>
              <p>Personne ne reste bloqué. On passe à côté de vous, sur votre écran.</p>
            </div>
            <div>
              <div className="seats" aria-hidden="true">
                {Array.from({ length: GROUP_SIZE + 2 }).map((_, i) => (
                  <span key={i} className={`seat${i === 2 || i === 7 ? ' trainer' : ''}`} />
                ))}
              </div>
              <div className="seats-legend" style={{ marginTop: 20 }}>
                <span>8 participants</span>
                <span className="t">2 formateurs</span>
              </div>
            </div>
          </div>
          <div className="card feature">
            <Icon name="phone" />
            <h3>Sur vos vrais comptes.</h3>
            <p>Votre fiche Google, votre Instagram, vos devis. Ce que vous faites en atelier est en ligne le soir même.</p>
          </div>
          <div className="card feature">
            <Icon name="cup" />
            <h3>Le café est offert.</h3>
            <p>On commence par un café et on parle de votre commerce. Le reste suit.</p>
          </div>
        </div>
        <SectionCta />
      </div>
    </section>
  )
}
