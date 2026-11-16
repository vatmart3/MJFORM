// Ateliers en présentiel : dates, jauge, inscrits.
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { motion } from 'motion/react'
import { ArrowLeft, CalendarDays, ChevronRight, MapPin, Plus, Trash2, UserPlus, Users } from 'lucide-react'
import { useBackend } from '../state'
import { useToast } from '../ui/toast'
import { Button, EmptyState, Modal, Page, Skeleton, itemVariants, listVariants } from '../ui/kit'
import { formatDate } from '../data/logic'
import type { Workshop } from '../data/types'
import { ConfirmModal, Field, errorText, isEmail, isoToParisLocal, parisLocalToIso, useLoad } from './shared'

interface WDraft {
  title: string
  start: string
  end: string
  location: string
  capacity: string
  bookingUrl: string
}
const toDraft = (w?: Workshop | null): WDraft => ({
  title: w?.title ?? 'Atelier MJ FORM',
  start: isoToParisLocal(w?.startsAt),
  end: isoToParisLocal(w?.endsAt),
  location: w?.location ?? 'Sète',
  capacity: String(w?.capacity ?? 8),
  bookingUrl: w?.bookingUrl ?? '/#reserver',
})

function validate(d: WDraft) {
  const errs: Partial<Record<keyof WDraft, string>> = {}
  const capacity = Number(d.capacity)
  if (!d.title.trim()) errs.title = 'Indiquez un titre.'
  if (!d.start) errs.start = 'Indiquez la date et l’heure de début.'
  if (d.end && d.start && d.end <= d.start) errs.end = 'La fin doit être après le début.'
  if (!Number.isInteger(capacity) || capacity < 1) errs.capacity = 'Indiquez un nombre de places (au moins 1).'
  const payload: Partial<Workshop> = {
    title: d.title.trim(),
    startsAt: parisLocalToIso(d.start),
    endsAt: d.end ? parisLocalToIso(d.end) : null,
    location: d.location.trim(),
    capacity,
    bookingUrl: d.bookingUrl.trim(),
  }
  return { errs, payload }
}

const dateLong = (iso: string) => formatDate(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const time = (iso: string) => formatDate(iso, { hour: '2-digit', minute: '2-digit' })
const schedule = (w: Workshop) => `${dateLong(w.startsAt)}, ${time(w.startsAt)}${w.endsAt ? ` – ${time(w.endsAt)}` : ''}`

function Seats({ w }: { w: Workshop }) {
  if (w.seatsLeft === null) return <span className="small muted">{w.capacity} places</span>
  return (
    <span className="adm-seats">
      <strong className={w.seatsLeft === 0 ? 'adm-danger-text' : undefined}>{w.seatsLeft === 0 ? 'Complet' : w.seatsLeft}</strong>
      <span className="small muted">
        {w.seatsLeft === 0 ? `${w.capacity} places` : `place${w.seatsLeft > 1 ? 's' : ''} restante${w.seatsLeft > 1 ? 's' : ''} sur ${w.capacity}`}
      </span>
    </span>
  )
}

export function Workshops() {
  const { admin } = useBackend()
  const toast = useToast()
  const navigate = useNavigate()
  const { data, error, reload } = useLoad(() => admin.listWorkshops(), [admin])
  const [creating, setCreating] = useState(false)

  const now = Date.now()
  const upcoming = data?.filter((w) => new Date(w.endsAt ?? w.startsAt).getTime() >= now) ?? []
  const past = (data?.filter((w) => new Date(w.endsAt ?? w.startsAt).getTime() < now) ?? []).reverse()

  const list = (items: Workshop[]) => (
    <motion.ul className="adm-list" variants={listVariants} initial="hidden" animate="show">
      {items.map((w) => (
        <motion.li key={w.id} variants={itemVariants}>
          <Link to={`/admin/ateliers/${w.id}`} className="adm-list-row adm-workshop-row">
            <span className="adm-date" aria-hidden="true">
              <span>{formatDate(w.startsAt, { day: 'numeric' })}</span>
              <span>{formatDate(w.startsAt, { month: 'short' }).replace('.', '')}</span>
            </span>
            <span className="adm-ftitle">
              <strong>{w.title}</strong>
              <span className="small muted">
                <span className="sr-only">{dateLong(w.startsAt)}, </span>
                {time(w.startsAt)}
                {w.endsAt ? ` – ${time(w.endsAt)}` : ''} · {w.location || 'Lieu à préciser'}
              </span>
            </span>
            <Seats w={w} />
            <ChevronRight className="adm-chev" aria-hidden="true" />
          </Link>
        </motion.li>
      ))}
    </motion.ul>
  )

  return (
    <Page
      kicker="Présentiel"
      title="Ateliers"
      sub="Dates, jauge et inscrits. Les places restantes s’affichent sur le site et dans l’espace client."
      actions={
        <Button onClick={() => setCreating(true)}>
          <Plus aria-hidden="true" />
          Nouvel atelier
        </Button>
      }
    >
      {error ? (
        <div className="panel soft row between wrap" role="alert">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={reload}>
            Réessayer
          </Button>
        </div>
      ) : !data ? (
        <div className="stack" aria-busy="true" aria-label="Chargement des ateliers">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} h={72} r={14} />
          ))}
        </div>
      ) : data.length === 0 ? (
        <EmptyState
          icon={<CalendarDays />}
          title="Aucun atelier programmé"
          text="Ajoutez une date d’atelier : elle apparaîtra avec ses places restantes, et vous pourrez y rattacher les participants importés."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" />
              Nouvel atelier
            </Button>
          }
        />
      ) : (
        <div className="stack-lg">
          <section aria-labelledby="w-up">
            <h2 className="section-title" id="w-up">
              À venir
            </h2>
            {upcoming.length ? list(upcoming) : <p className="muted small">Aucun atelier à venir.</p>}
          </section>
          {past.length ? (
            <section aria-labelledby="w-past">
              <h2 className="section-title" id="w-past">
                Passés
              </h2>
              {list(past)}
            </section>
          ) : null}
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvel atelier" labelledBy="new-w-title">
        <WorkshopForm
          submitLabel="Créer l’atelier"
          onCancel={() => setCreating(false)}
          onSubmit={async (payload) => {
            try {
              const w = await admin.saveWorkshop(payload)
              toast('Atelier créé')
              setCreating(false)
              navigate(`/admin/ateliers/${w.id}`)
            } catch (e) {
              toast(errorText(e), 'error')
            }
          }}
        />
      </Modal>
    </Page>
  )
}

function WorkshopForm({ initial, submitLabel, onSubmit, onCancel, idPrefix = 'w' }: { initial?: Workshop | null; submitLabel: string; onSubmit: (p: Partial<Workshop>) => Promise<void>; onCancel?: () => void; idPrefix?: string }) {
  const [d, setD] = useState<WDraft>(() => toDraft(initial))
  const [errs, setErrs] = useState<Partial<Record<keyof WDraft, string>>>({})
  const [busy, setBusy] = useState(false)
  const set = (k: keyof WDraft, v: string) => {
    setD((x) => ({ ...x, [k]: v }))
    setErrs((e) => ({ ...e, [k]: undefined }))
  }
  const id = (k: string) => `${idPrefix}-${k}`
  const inputProps = (k: keyof WDraft) => ({
    id: id(k),
    className: 'input',
    value: d[k],
    onChange: (e: { target: { value: string } }) => set(k, e.target.value),
    'aria-invalid': errs[k] ? true : undefined,
    'aria-describedby': errs[k] ? `${id(k)}-err` : undefined,
  })

  async function submit(e: FormEvent) {
    e.preventDefault()
    const { errs: v, payload } = validate(d)
    setErrs(v)
    if (Object.keys(v).length) return
    setBusy(true)
    try {
      await onSubmit(payload)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <Field id={id('title')} label="Titre" error={errs.title}>
        <input {...inputProps('title')} />
      </Field>
      <div className="adm-grid-2">
        <Field id={id('start')} label="Début (heure de Paris)" error={errs.start}>
          <input {...inputProps('start')} type="datetime-local" />
        </Field>
        <Field id={id('end')} label="Fin (facultatif)" error={errs.end}>
          <input {...inputProps('end')} type="datetime-local" min={d.start || undefined} />
        </Field>
      </div>
      <div className="adm-grid-2">
        <Field id={id('location')} label="Lieu">
          <input {...inputProps('location')} />
        </Field>
        <Field id={id('capacity')} label="Capacité (places)" error={errs.capacity}>
          <input {...inputProps('capacity')} type="number" min={1} step={1} inputMode="numeric" />
        </Field>
      </div>
      <Field id={id('bookingUrl')} label="Lien de réservation" hint="Page du site où réserver, ex. /#reserver">
        <input {...inputProps('bookingUrl')} className="input adm-mono" aria-describedby={`${id('bookingUrl')}-hint`} />
      </Field>
      <div className="row wrap adm-modal-actions">
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Annuler
          </Button>
        ) : null}
        <Button type="submit" loading={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

export function WorkshopDetail() {
  const { id = '' } = useParams()
  const { admin } = useBackend()
  const toast = useToast()
  const navigate = useNavigate()
  const { data, error, reload } = useLoad(async () => {
    const [all, bookings] = await Promise.all([admin.listWorkshops(), admin.listBookings(id)])
    const workshop = all.find((w) => w.id === id)
    if (!workshop) throw new Error('not-found')
    return { workshop, bookings: [...bookings].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) }
  }, [admin, id])
  const [confirm, setConfirm] = useState(false)

  const back = (
    <Link to="/admin/ateliers" className="adm-back">
      <ArrowLeft aria-hidden="true" />
      Ateliers
    </Link>
  )

  if (error) {
    return (
      <Page kicker={back} title="Atelier introuvable">
        <EmptyState icon={<CalendarDays />} title="Cet atelier n’existe plus" text={error} action={<Link className="btn btn-primary" to="/admin/ateliers">Retour aux ateliers</Link>} />
      </Page>
    )
  }
  if (!data) {
    return (
      <div className="stack-lg" aria-busy="true" aria-label="Chargement de l’atelier">
        <div className="stack" style={{ gap: 10 }}>
          <Skeleton h={14} w={100} />
          <Skeleton h={40} w="50%" />
        </div>
        <Skeleton h={300} r={20} />
      </div>
    )
  }
  const { workshop: w, bookings } = data

  return (
    <Page
      kicker={back}
      title={w.title}
      sub={
        <span className="row wrap" style={{ gap: '4px 16px' }}>
          <span className="adm-meta">
            <CalendarDays aria-hidden="true" />
            {schedule(w)}
          </span>
          <span className="adm-meta">
            <MapPin aria-hidden="true" />
            {w.location || 'Lieu à préciser'}
          </span>
        </span>
      }
    >
      <div className="adm-split">
        <section className="stack" aria-labelledby="bk-title">
          <div className="row between wrap">
            <h2 className="section-title" id="bk-title" style={{ margin: 0 }}>
              Inscrits <span className="muted">({bookings.length}/{w.capacity})</span>
            </h2>
            <Seats w={w} />
          </div>
          {bookings.length ? (
            <motion.ul className="adm-list" variants={listVariants} initial="hidden" animate="show">
              {bookings.map((b) => (
                <motion.li key={b.id} variants={itemVariants} className="adm-list-row adm-booking" style={{ cursor: 'default' }}>
                  <span className="adm-ftitle">
                    <strong>{b.name || b.email}</strong>
                    <span className="small muted">
                      <a href={`mailto:${b.email}`}>{b.email}</a>
                      {b.phone ? ` · ${b.phone}` : ''}
                    </span>
                  </span>
                  <span className="tiny muted adm-nowrap">Inscrit le {formatDate(b.createdAt, { day: 'numeric', month: 'short' })}</span>
                </motion.li>
              ))}
            </motion.ul>
          ) : (
            <EmptyState icon={<Users />} title="Aucun inscrit" text="Ajoutez les inscriptions reçues par téléphone ou sur place, ou importez la liste des participants après l’atelier." />
          )}
          <AddBooking workshopId={w.id} full={w.seatsLeft === 0} onAdded={reload} />
        </section>

        <section className="panel stack" aria-labelledby="w-info">
          <h2 className="section-title" id="w-info" style={{ margin: 0 }}>
            Informations
          </h2>
          <WorkshopForm
            key={`${w.id}-${w.startsAt}-${w.title}`}
            idPrefix="we"
            initial={w}
            submitLabel="Enregistrer"
            onSubmit={async (payload) => {
              try {
                await admin.saveWorkshop({ ...payload, id: w.id })
                toast('Atelier enregistré')
                await reload()
              } catch (e) {
                toast(errorText(e), 'error')
              }
            }}
          />
          <hr className="divider" />
          <div>
            <Button variant="danger" size="sm" onClick={() => setConfirm(true)}>
              <Trash2 aria-hidden="true" />
              Supprimer l’atelier
            </Button>
          </div>
        </section>
      </div>

      <ConfirmModal
        open={confirm}
        title="Supprimer cet atelier ?"
        text={`L’atelier du ${dateLong(w.startsAt)} et sa liste de ${bookings.length} inscrit${bookings.length > 1 ? 's' : ''} seront supprimés. Les accès aux formations déjà donnés sont conservés.`}
        confirmLabel="Supprimer l’atelier"
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          try {
            await admin.deleteWorkshop(w.id)
            toast('Atelier supprimé')
            navigate('/admin/ateliers', { replace: true })
          } catch (e) {
            toast(errorText(e), 'error')
          }
        }}
      />
    </Page>
  )
}

function AddBooking({ workshopId, full, onAdded }: { workshopId: string; full: boolean; onAdded: () => Promise<unknown> }) {
  const { admin } = useBackend()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!isEmail(email)) return setErr('Indiquez une adresse e-mail valide.')
    setBusy(true)
    try {
      await admin.addBooking({ workshopId, name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim() })
      await onAdded()
      toast('Inscrit ajouté')
      setName('')
      setEmail('')
      setPhone('')
      setOpen(false)
    } catch (x) {
      toast(errorText(x), 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <div>
        <button type="button" className="adm-add" onClick={() => setOpen(true)}>
          <UserPlus aria-hidden="true" />
          Ajouter un inscrit
        </button>
      </div>
    )
  }
  return (
    <form className="panel soft stack" onSubmit={submit} noValidate aria-labelledby="add-bk">
      <h3 id="add-bk" style={{ margin: 0, fontSize: 17 }}>
        Ajouter un inscrit
      </h3>
      {full ? (
        <p className="small adm-danger-text" style={{ margin: 0 }}>
          L’atelier est complet : l’inscription dépassera la capacité prévue.
        </p>
      ) : null}
      <Field id="bk-name" label="Nom">
        <input id="bk-name" className="input" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="adm-grid-2">
        <Field id="bk-email" label="E-mail" error={err}>
          <input
            id="bk-email"
            className="input"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setErr(null)
            }}
            aria-invalid={err ? true : undefined}
            aria-describedby={err ? 'bk-email-err' : undefined}
          />
        </Field>
        <Field id="bk-phone" label="Téléphone (facultatif)">
          <input id="bk-phone" className="input" type="tel" autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
      </div>
      <div className="row wrap" style={{ gap: 8 }}>
        <Button type="submit" size="sm" loading={busy}>
          Ajouter
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={busy}>
          Annuler
        </Button>
      </div>
    </form>
  )
}
