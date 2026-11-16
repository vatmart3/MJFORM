// Page /merci : récapitule la réservation payée (atelier, date, adresse) à partir de la session Stripe.
import './page'
import { ADDRESS_FALLBACK } from './data/sessions'

interface Summary {
  atelier: string
  duration: string
  date: string
  hours: string
  address: string | null
  amount: number
  pack: boolean
}

const field = (name: string) => document.querySelector<HTMLElement>(`[data-field="${name}"]`)
const show = (name: string, text?: string) => {
  const row = field(`${name}-row`) ?? field(name)
  if (text != null) field(name)!.textContent = text
  if (row) row.hidden = false
}

const id = new URLSearchParams(window.location.search).get('session_id')
if (id) {
  fetch(`/api/session?id=${encodeURIComponent(id)}`)
    .then((r) => (r.ok ? (r.json() as Promise<Summary>) : null))
    .then((s) => {
      if (!s) return
      show('atelier', `${s.atelier} · ${s.duration}`)
      show('date', `${s.date} · ${s.hours}`)
      show('amount', new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(s.amount).replace(',00', ''))
      if (s.pack) show('pack-note')
      const dd = field('address')!
      if (s.address) {
        // Adresse renseignée (ADRESSE_ATELIER) : lien vers l'itinéraire
        const a = document.createElement('a')
        a.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address)}`
        a.target = '_blank'
        a.rel = 'noopener'
        a.textContent = s.address
        dd.replaceChildren(a)
      } else {
        dd.textContent = ADDRESS_FALLBACK
      }
    })
    .catch(() => {})
}
