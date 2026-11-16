import { useEffect, useState } from 'react'
import { ATELIERS, formatPrice } from '../data/ateliers'
import { BookLink } from './ui'

const from = Math.min(...ATELIERS.map((a) => a.price))

/** Bouton « Réserver » toujours visible en bas sur mobile, masqué sur l'accroche et dans le configurateur. */
export function StickyBook() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const hero = document.querySelector('.hero')
    const booking = document.querySelector('#reserver')
    const state = { pastHero: false, inBooking: false }
    const update = () => setShow(state.pastHero && !state.inBooking)
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === hero) state.pastHero = !e.isIntersecting
        if (e.target === booking) state.inBooking = e.isIntersecting
      }
      update()
    })
    if (hero) io.observe(hero)
    if (booking) io.observe(booking)
    return () => io.disconnect()
  }, [])
  return (
    <div className={`sticky-book${show ? ' show' : ''}`} aria-hidden={!show} inert={!show}>
      <div className="info">
        <strong>Ateliers IA à Sète</strong>
        Dès {formatPrice(from)} · 8 places par groupe
      </div>
      <BookLink className="btn btn-primary">Réserver</BookLink>
    </div>
  )
}
