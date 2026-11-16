// Coordonnées et réglages publics. Les valeurs viennent des variables d'environnement
// (voir .env.example). Une valeur vide n'est jamais remplacée par une valeur inventée.

const clean = (v?: string) => (v ?? '').trim()

export const SITE_URL = clean(import.meta.env.VITE_SITE_URL) || 'https://mjform.fr'

export const CONTACT = {
  phone: clean(import.meta.env.VITE_CONTACT_PHONE),
  email: clean(import.meta.env.VITE_CONTACT_EMAIL),
}

export const telHref = (phone: string) => `tel:${phone.replace(/[^+\d]/g, '')}`

export const LAUNCH = {
  dateLabel: 'Vendredi 4 décembre',
  atelierId: 'ia-comptoir',
  price: 49,
  regularPrice: 149,
  capacity: 8,
}

export const GROUP_SIZE = 8
