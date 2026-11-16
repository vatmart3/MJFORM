// Outils communs du back-office : chargement, confirmation, champs, dates de Paris.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Modal } from '../ui/kit'

/** Charge une donnée asynchrone ; `reload` relance sans effacer l'affichage courant. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fnRef = useRef(fn)
  fnRef.current = fn
  const reload = useCallback(async () => {
    try {
      const v = await fnRef.current()
      setData(v)
      setError(null)
      return v
    } catch (e) {
      setError(errorText(e))
      return null
    }
  }, [])
  useEffect(() => {
    setData(null)
    reload()
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  return { data, error, reload, setData }
}

const ERRORS: Record<string, string> = {
  forbidden: 'Accès réservé aux administrateurs.',
  'not-found': 'Élément introuvable : il a peut-être été supprimé.',
  'not-authenticated': 'Votre session a expiré. Reconnectez-vous.',
}
export const errorText = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e)
  return ERRORS[m] ?? 'Une erreur est survenue. Réessayez dans un instant.'
}

/** Fenêtre de confirmation avant une action destructrice. */
export function ConfirmModal({
  open,
  title,
  text,
  confirmLabel = 'Supprimer',
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  text: ReactNode
  confirmLabel?: string
  onConfirm: () => Promise<void>
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  return (
    <Modal open={open} onClose={() => !busy && onClose()} title={title} labelledBy="confirm-title">
      <div className="stack">
        <p className="muted" style={{ margin: 0 }}>
          {text}
        </p>
        <div className="row wrap adm-modal-actions">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button
            variant="danger"
            loading={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onConfirm()
              } finally {
                setBusy(false)
              }
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/** Champ de formulaire avec libellé, aide et erreur reliés. */
export function Field({ id, label, hint, error, children }: { id: string; label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? (
        <span className="hint" id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="err" id={`${id}-err`} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  )
}

/** Choix exclusif présenté en segments (boutons radio natifs, accessibles au clavier). */
export function Segmented<T extends string>({
  name,
  legend,
  value,
  options,
  onChange,
  hideLegend,
}: {
  name: string
  legend: string
  value: T
  options: { value: T; label: string; icon?: ReactNode }[]
  onChange: (v: T) => void
  hideLegend?: boolean
}) {
  return (
    <fieldset className="adm-fieldset">
      <legend className={hideLegend ? 'sr-only' : 'adm-legend'}>{legend}</legend>
      <div className="adm-seg">
        {options.map((o) => (
          <label key={o.value} className={value === o.value ? 'on' : undefined}>
            <input type="radio" className="sr-only" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            {o.icon}
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim())

// ——— Dates : saisie « datetime-local » interprétée à l'heure de Paris ———

const pad = (n: number) => String(n).padStart(2, '0')

/** Décalage de Paris (minutes) à un instant donné */
function parisOffsetMin(utcMs: number) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(utcMs))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'))
  return Math.round((wall - Math.floor(utcMs / 60000) * 60000) / 60000)
}

/** « 2026-12-04T18:30 » (heure de Paris) → « 2026-12-04T18:30:00+01:00 » */
export function parisLocalToIso(local: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local)
  if (!m) return ''
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])
  let off = parisOffsetMin(wall)
  off = parisOffsetMin(wall - off * 60000)
  const sign = off >= 0 ? '+' : '-'
  const a = Math.abs(off)
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`
}

/** ISO → valeur « datetime-local » à l'heure de Paris */
export function isoToParisLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const d = new Date(t + parisOffsetMin(t) * 60000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

/** Taille lisible d'un fichier */
export const fileSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`

/** Annonce discrète pour les lecteurs d'écran (déplacements au clavier). */
export function useAnnouncer() {
  const [msg, setMsg] = useState('')
  const node = (
    <p className="sr-only" role="status" aria-live="polite">
      {msg}
    </p>
  )
  return { announce: (m: string) => setMsg((prev) => (prev === m ? `${m} ` : m)), node }
}
