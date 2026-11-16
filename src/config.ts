// Coordonnées et réglages publics.
import { PILOT_SESSION_ID } from './data/sessions'

export const SITE_URL = 'https://mjform.fr'

export const CONTACT = {
  phone: '06 11 71 83 68',
  tel: 'tel:+33611718368',
  whatsapp: 'https://wa.me/33611718368',
  email: 'jeremyvatuonepro@gmail.com',
}

/** Session de lancement : l'atelier spécial fêtes (pilote). */
export const LAUNCH = {
  dateLabel: 'Vendredi 4 décembre',
  atelierId: 'fetes',
  sessionId: PILOT_SESSION_ID,
  price: 49,
  laterPrice: 149,
  capacity: 8,
}

export const GROUP_SIZE = 8

/** Section « Ils en parlent » : à passer à true dès qu'il y a de vrais avis (src/components/Reviews.tsx). */
export const SHOW_REVIEWS = false
