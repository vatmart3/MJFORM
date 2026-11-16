import { useState } from 'react'
import { ATELIERS, LEVELS, ateliersOf, formatPrice, type Atelier, type LevelId } from '../data/ateliers'
import { BookLink, Eyebrow, SectionCta, SplitTitle } from './ui'

const SPECS: Array<{ label: string; n1: string; n2: string }> = [
  { label: 'Pour qui', n1: 'Vous débutez avec l’IA', n2: 'Vous utilisez déjà ChatGPT ou Claude' },
  { label: 'Format', n1: '4 ateliers de 3 h', n2: '1 atelier de 3 h, 3 ateliers de 6 h' },
  { label: 'Matériel', n1: 'Votre téléphone', n2: 'Votre téléphone et un ordinateur portable' },
  { label: 'Groupe', n1: '8 personnes, 2 formateurs', n2: '8 personnes, 2 formateurs' },
  { label: 'Suivi après l’atelier', n1: '14 jours', n2: '14 jours' },
]

const minPrice = (level: LevelId) => Math.min(...ateliersOf(level).filter((a) => !a.pack).map((a) => a.price))

function AtelierCard({ a }: { a: Atelier }) {
  return (
    <article className={`cmp-atelier${a.pack ? ' pack' : ''}`} id={`atelier-${a.id}`}>
      <div className="top">
        <h4>{a.name}</h4>
        <div className="price">
          {a.compareAt ? (
            <s className="strike" aria-label={`Prix normal ${formatPrice(a.compareAt)}`}>
              {formatPrice(a.compareAt)}
            </s>
          ) : null}
          {formatPrice(a.price)}
        </div>
      </div>
      <div className="dur">{a.duration}</div>
      {a.compareAt ? <span className="saving">{formatPrice(a.compareAt - a.price)} d’économie</span> : null}
      <p className="pitch">{a.pitch}</p>
      <p className="takeaways-label">Ce que vous emportez</p>
      <ul className="takeaways">
        {a.takeaways.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <div className="book">
        <BookLink atelierId={a.id}>{a.pack ? 'Réserver le pack' : 'Réserver cet atelier'}</BookLink>
      </div>
    </article>
  )
}

export function Compare() {
  const [show, setShow] = useState<LevelId>('n1')
  const n1 = ateliersOf('n1')
  const n2 = ateliersOf('n2')
  const rows = Math.max(n1.length, n2.length)

  return (
    <section className="section" id="ateliers" aria-labelledby="ateliers-title">
      <div className="wrap">
        <div className="head">
          <Eyebrow>Les ateliers</Eyebrow>
          <SplitTitle first="Deux niveaux." second="Un seul objectif." id="ateliers-title" />
          <p className="lead" data-reveal="">
            Gagner du temps dans votre commerce. Dès la semaine prochaine.
          </p>
        </div>

        <div className="compare-switch">
          <div className="segmented" role="group" aria-label="Choisir le niveau" data-active={show === 'n1' ? '0' : '1'}>
            <span className="thumb" aria-hidden="true" />
            {LEVELS.map((l) => (
              <button key={l.id} type="button" aria-pressed={show === l.id} onClick={() => setShow(l.id)}>
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="compare" data-show={show}>
          {/* En-têtes */}
          {LEVELS.map((l) => (
            <div key={l.id} className={`col-${l.id} cmp-head`} data-reveal="">
              <div className="lvl">{l.label}</div>
              <h3>{l.name}</h3>
              <p>{l.tagline}</p>
              <div className="from">À partir de {formatPrice(minPrice(l.id))}</div>
              <BookLink atelierId={ateliersOf(l.id)[0].id} className="btn btn-primary btn-sm">
                Réserver
              </BookLink>
            </div>
          ))}

          {/* Caractéristiques, ligne par ligne comme une page de comparaison */}
          {SPECS.map((s) =>
            (['n1', 'n2'] as const).map((lvl) => (
              <dl key={s.label + lvl} className={`col-${lvl} cmp-spec`}>
                <dt>{s.label}</dt>
                <dd>{s[lvl]}</dd>
              </dl>
            )),
          )}

          {/* Ateliers, alignés par rangée */}
          {Array.from({ length: rows }).map((_, i) =>
            [n1[i], n2[i]].map((a, c) =>
              a ? (
                <div key={a.id} className={`col-${a.level}`}>
                  <AtelierCard a={a} />
                </div>
              ) : (
                <div key={`empty-${i}-${c}`} className={`col-n${c + 1}`} />
              ),
            ),
          )}
        </div>

        <p className="center muted" style={{ fontSize: 14, marginTop: 32 }} data-reveal="">
          Prix TTC par personne. Les {ATELIERS.filter((a) => a.pack).length} packs regroupent les ateliers de leur niveau ; le prix
          barré est la somme des ateliers achetés un par un.
        </p>
        <SectionCta secondary={{ href: '#temps', label: 'Calculer le temps gagné' }} />
      </div>
    </section>
  )
}
