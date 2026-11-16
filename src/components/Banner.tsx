import { LAUNCH } from '../config'
import { formatPrice } from '../data/ateliers'
import { BookLink } from './ui'

export function Banner() {
  return (
    <div className="banner" role="region" aria-label="Session de lancement">
      <BookLink atelierId={LAUNCH.atelierId} className="">
        <span className="long">
          <strong>Session de lancement</strong>
          <span className="sep">·</span>
          {LAUNCH.dateLabel}
          <span className="sep">·</span>
          {formatPrice(LAUNCH.price)} au lieu de {formatPrice(LAUNCH.regularPrice)}
          <span className="sep">·</span>
          {LAUNCH.capacity} places <span className="arrow">↗</span>
        </span>
        <span className="short">
          <strong>Lancement</strong>
          <span className="sep">·</span>Ven. 4 déc.<span className="sep">·</span>
          {formatPrice(LAUNCH.price)} au lieu de {formatPrice(LAUNCH.regularPrice)}
          <span className="sep">·</span>
          {LAUNCH.capacity} places <span className="arrow">↗</span>
        </span>
      </BookLink>
    </div>
  )
}
