// Comparatif des deux formats, sous le comparateur des ateliers.
import { FORMATS, ONLINE_SURCHARGE, formatPrice, priceOf, regularAteliers } from '../data/ateliers'

type Cell = boolean | string
const ROWS: Array<{ label: string; presentiel: Cell; online: Cell }> = [
  { label: 'Formateur à côté de vous', presentiel: true, online: false },
  { label: 'Questions en direct', presentiel: true, online: false },
  { label: 'Résultats faits pendant l’atelier', presentiel: true, online: false },
  { label: 'Rencontre avec d’autres commerçants', presentiel: true, online: false },
  { label: 'Contenu en ligne', presentiel: 'inclus', online: true },
  { label: 'À votre rythme', presentiel: 'replays inclus', online: true },
]

function Mark({ v }: { v: Cell }) {
  if (v === false)
    return (
      <span className="fc-no">
        <span aria-hidden="true">—</span>
        <span className="sr-only">Non</span>
      </span>
    )
  return (
    <span className="fc-yes">
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
        <path d="M4.5 10.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {typeof v === 'string' ? <span>{v}</span> : <span className="sr-only">Oui</span>}
    </span>
  )
}

export function FormatCompare() {
  const from = Math.min(...regularAteliers().map((a) => a.price))
  const fromOnline = Math.min(...regularAteliers().map((a) => priceOf(a, 'online')))
  return (
    <div className="fc" data-reveal="">
      <h3 className="fc-title">Deux formats. À vous de choisir.</h3>
      <table className="fc-table">
        <caption className="sr-only">Comparatif des formats en présentiel et en ligne</caption>
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Critère</span>
            </th>
            <th scope="col">
              {FORMATS.presentiel.label}
              <span className="reco">Recommandé</span>
            </th>
            <th scope="col">{FORMATS.online.label}</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td>
                <Mark v={r.presentiel} />
              </td>
              <td>
                <Mark v={r.online} />
              </td>
            </tr>
          ))}
          <tr className="fc-price">
            <th scope="row">Prix</th>
            <td>Dès {formatPrice(from)}</td>
            <td>
              Dès {formatPrice(fromOnline)}
              <span className="fc-sub">+{ONLINE_SURCHARGE} € par atelier</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p className="fc-note">Le présentiel est moins cher parce qu’on forme en groupe. L’accès en ligne est une licence individuelle.</p>
    </div>
  )
}
