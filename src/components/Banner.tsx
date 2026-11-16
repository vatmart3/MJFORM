import { LAUNCH } from '../config'
import { formatPrice } from '../data/ateliers'
import { BookLink } from './ui'

export function Banner() {
  const price = `${formatPrice(LAUNCH.price)} · prix de lancement (ensuite ${formatPrice(LAUNCH.laterPrice)})`
  return (
    <div className="banner" role="region" aria-label="Session de lancement">
      <BookLink atelierId={LAUNCH.atelierId} sessionId={LAUNCH.sessionId} className="">
        <span className="long">
          <strong>Session de lancement</strong>
          <span className="sep">·</span>
          {LAUNCH.dateLabel}
          <span className="sep">·</span>
          {price}
          <span className="sep">·</span>
          {LAUNCH.capacity} places <span className="arrow">↗</span>
        </span>
        <span className="short">
          <strong>Lancement</strong>
          <span className="sep">·</span>Ven. 4 déc.<span className="sep">·</span>
          {price} <span className="arrow">↗</span>
        </span>
      </BookLink>
    </div>
  )
}
