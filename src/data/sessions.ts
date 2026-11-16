// Sessions programmées. Source unique pour le configurateur et les fonctions de paiement (api/).
// Aucune dépendance au navigateur ni à Vite : ce fichier est aussi importé côté serveur.
import { regularAteliers } from './ateliers.js'

/** Adresse affichée quand la variable ADRESSE_ATELIER n'est pas renseignée. */
export const ADDRESS_FALLBACK = 'Sète · l’adresse exacte vous est envoyée par SMS la veille'

export interface Session {
  id: string
  /** Début et fin, heure de Paris (décalage explicite) */
  start: string
  end?: string
  /** Places par atelier proposé sur cette date */
  capacity: number
  /** Ateliers réservables à cette date */
  ateliers: string[]
}

const regular = regularAteliers().map((a) => a.id)

export const SESSIONS: Session[] = [
  {
    id: '2026-12-04-fetes',
    start: '2026-12-04T18:30:00+01:00',
    end: '2026-12-04T21:30:00+01:00',
    capacity: 8,
    ateliers: ['fetes'],
  },
  { id: '2027-01-15', start: '2027-01-15T18:30:00+01:00', capacity: 8, ateliers: regular },
  { id: '2027-01-25', start: '2027-01-25T19:00:00+01:00', capacity: 8, ateliers: regular },
]

export const PILOT_SESSION_ID = '2026-12-04-fetes'

/** Clé de stock : une jauge par date et par atelier. */
export const slotKey = (sessionId: string, atelierId: string) => `${sessionId}:${atelierId}`

export const sessionById = (id: string) => SESSIONS.find((s) => s.id === id)

export const upcomingSessions = (now = Date.now()) => SESSIONS.filter((s) => new Date(s.start).getTime() > now)

/** Variable d'environnement contenant l'identifiant de prix Stripe d'un atelier. Ex. STRIPE_PRICE_IA_COMPTOIR */
export const priceEnvName = (atelierId: string) => `STRIPE_PRICE_${atelierId.toUpperCase().replace(/-/g, '_')}`

const fmtDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })
const fmtTime = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })

export const formatDay = (d: Date) => {
  const s = fmtDay.format(d)
  return s.charAt(0).toUpperCase() + s.slice(1)
}
// Espaces insécables : « 18 h 30 » ne se coupe jamais en fin de ligne
export const formatTime = (d: Date) => fmtTime.format(d).replace(':', '\u00a0h\u00a0').replace('\u00a0h\u00a000', '\u00a0h')
export const formatHours = (s: Session) =>
  s.end ? `${formatTime(new Date(s.start))} – ${formatTime(new Date(s.end))}` : formatTime(new Date(s.start))
