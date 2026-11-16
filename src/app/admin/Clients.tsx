// Clients : accès, progression, achats et parrainages ; attribution manuelle d'un accès.
import { useMemo, useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import { KeyRound, Search, Users } from 'lucide-react'
import { useBackend } from '../state'
import { useToast } from '../ui/toast'
import { Avatar, Button, EmptyState, Modal, Page, ProgressBar, Skeleton, itemVariants, listVariants } from '../ui/kit'
import { formatEuro } from '../data/logic'
import type { ClientRow, EnrollmentSource, Formation } from '../data/types'
import { Field, Segmented, errorText, isEmail, useLoad } from './shared'

const SOURCES: { value: EnrollmentSource; label: string }[] = [
  { value: 'workshop', label: 'Atelier payé sur place' },
  { value: 'gift', label: 'Offert' },
  { value: 'purchase', label: 'Achat' },
]
const SOURCE_LABEL: Record<EnrollmentSource, string> = { workshop: 'Atelier', gift: 'Offert', purchase: 'Achat' }

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

export function Clients() {
  const { admin } = useBackend()
  const { data, error, reload } = useLoad(async () => {
    const [clients, formations] = await Promise.all([admin.listClients(), admin.listFormations()])
    return { clients, formations }
  }, [admin])
  const [q, setQ] = useState('')
  const [grantFor, setGrantFor] = useState<string | null>(null)

  const rows = useMemo(() => {
    if (!data) return []
    const needle = fold(q.trim())
    if (!needle) return data.clients
    return data.clients.filter((c) => fold(`${c.profile.firstName} ${c.profile.lastName} ${c.profile.company} ${c.profile.email}`).includes(needle))
  }, [data, q])

  const titleOf = (id: string) => data?.formations.find((f) => f.id === id)?.title ?? 'Formation supprimée'

  return (
    <Page
      kicker="Suivi"
      title="Clients"
      sub="Accès aux formations, progression, achats et parrainages de chaque client."
      actions={
        <Button onClick={() => setGrantFor('')}>
          <KeyRound aria-hidden="true" />
          Donner accès
        </Button>
      }
    >
      <div className="stack">
        <div className="adm-search">
          <Search aria-hidden="true" />
          <label htmlFor="client-search" className="sr-only">
            Rechercher un client
          </label>
          <input id="client-search" className="input" type="search" placeholder="Nom, entreprise ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {data ? (
          <p className="small muted" style={{ margin: 0 }} aria-live="polite">
            {rows.length} {rows.length > 1 ? 'clients' : 'client'}
            {q.trim() ? ` sur ${data.clients.length}` : ''}
          </p>
        ) : null}

        {error ? (
          <div className="panel soft row between wrap" role="alert">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={reload}>
              Réessayer
            </Button>
          </div>
        ) : !data ? (
          <div className="stack" aria-busy="true" aria-label="Chargement des clients">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} h={64} r={14} />
            ))}
          </div>
        ) : data.clients.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title="Aucun client pour l’instant"
            text="Les clients apparaissent ici dès leur première connexion, leur premier achat ou leur import après un atelier."
            action={<Button onClick={() => setGrantFor('')}>Donner accès à un client</Button>}
          />
        ) : rows.length === 0 ? (
          <EmptyState icon={<Search />} title="Aucun résultat" text={`Aucun client ne correspond à « ${q.trim()} ».`} action={<Button variant="ghost" onClick={() => setQ('')}>Effacer la recherche</Button>} />
        ) : (
          <div className="table-wrap adm-table-stack">
            <table className="table">
              <caption className="sr-only">Liste des clients</caption>
              <thead>
                <tr>
                  <th scope="col">Client</th>
                  <th scope="col">Formations</th>
                  <th scope="col" className="num">
                    Achats
                  </th>
                  <th scope="col" className="num">
                    Filleuls
                  </th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <motion.tbody variants={listVariants} initial="hidden" animate="show">
                {rows.map((c) => (
                  <ClientLine key={c.profile.id} c={c} titleOf={titleOf} onGrant={() => setGrantFor(c.profile.email)} />
                ))}
              </motion.tbody>
            </table>
          </div>
        )}
      </div>

      {data ? (
        <GrantModal
          open={grantFor !== null}
          email={grantFor ?? ''}
          formations={data.formations}
          onClose={() => setGrantFor(null)}
          onDone={() => {
            setGrantFor(null)
            reload()
          }}
        />
      ) : null}
    </Page>
  )
}

function ClientLine({ c, titleOf, onGrant }: { c: ClientRow; titleOf: (id: string) => string; onGrant: () => void }) {
  const p = c.profile
  const name = `${p.firstName} ${p.lastName}`.trim() || p.email
  const total = c.purchases.reduce((s, x) => s + x.amount, 0)
  return (
    <motion.tr variants={itemVariants}>
      <td data-label="Client">
        <div className="row" style={{ gap: 12, alignItems: 'center' }}>
          <Avatar name={name} url={p.avatarUrl} size={40} />
          <div className="adm-client">
            <strong>{name}</strong>
            {p.company ? <span className="small">{p.company}</span> : null}
            <a className="small muted" href={`mailto:${p.email}`}>
              {p.email}
            </a>
          </div>
        </div>
      </td>
      <td data-label="Formations">
        {c.enrollments.length ? (
          <ul className="adm-progress-list">
            {c.enrollments.map((e) => {
              const v = c.progress[e.formationId] ?? 0
              const t = titleOf(e.formationId)
              return (
                <li key={e.formationId}>
                  <div className="row between" style={{ gap: 8 }}>
                    <span className="small adm-ellipsis" title={t}>
                      {t}
                    </span>
                    <span className="tiny muted adm-nowrap">
                      {SOURCE_LABEL[e.source]} · {Math.round(v * 100)} %
                    </span>
                  </div>
                  <ProgressBar value={v} label={`Progression de ${name} sur « ${t} »`} />
                </li>
              )
            })}
          </ul>
        ) : (
          <span className="small muted">Aucun accès</span>
        )}
      </td>
      <td data-label="Achats" className="num">
        <span className="adm-strong-num">{formatEuro(total)}</span>
        <span className="tiny muted" style={{ display: 'block' }}>
          {c.purchases.length} {c.purchases.length > 1 ? 'achats' : 'achat'}
        </span>
      </td>
      <td data-label="Filleuls" className="num">
        <span className="adm-strong-num">
          {c.referralsPurchased}/{c.referralsTotal}
        </span>
        <span className="tiny muted" style={{ display: 'block' }}>
          ont acheté
        </span>
      </td>
      <td className="adm-cell-action">
        <Button variant="ghost" size="sm" onClick={onGrant} aria-label={`Donner accès à une formation pour ${name}`}>
          <KeyRound aria-hidden="true" />
          Donner accès
        </Button>
      </td>
    </motion.tr>
  )
}

function GrantModal({ open, email: initialEmail, formations, onClose, onDone }: { open: boolean; email: string; formations: Formation[]; onClose: () => void; onDone: () => void }) {
  const { admin } = useBackend()
  const toast = useToast()
  const [email, setEmail] = useState(initialEmail)
  const [formationId, setFormationId] = useState(formations[0]?.id ?? '')
  const [source, setSource] = useState<EnrollmentSource>('workshop')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [lastOpen, setLastOpen] = useState(false)

  // Réinitialise le formulaire à chaque ouverture
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setEmail(initialEmail)
      setFormationId(formations[0]?.id ?? '')
      setSource('workshop')
      setErr(null)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!isEmail(email)) return setErr('Indiquez une adresse e-mail valide.')
    if (!formationId) return
    setBusy(true)
    try {
      await admin.grantFormation(email.trim().toLowerCase(), formationId, source)
      toast('Accès accordé')
      onDone()
    } catch (x) {
      toast(errorText(x), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={() => !busy && onClose()} title="Donner accès à une formation" labelledBy="grant-title">
      <form className="stack" onSubmit={submit} noValidate>
        <p className="muted small" style={{ margin: 0 }}>
          Si l’adresse n’a pas encore de compte, il est créé : la personne se connectera avec un lien envoyé par e-mail.
        </p>
        <Field id="g-email" label="E-mail du client" error={err}>
          <input
            id="g-email"
            className="input"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setErr(null)
            }}
            aria-invalid={err ? true : undefined}
            aria-describedby={err ? 'g-email-err' : undefined}
          />
        </Field>
        <Field id="g-formation" label="Formation">
          <select id="g-formation" className="select" value={formationId} onChange={(e) => setFormationId(e.target.value)}>
            {formations.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title}
                {f.status === 'draft' ? ' (brouillon)' : ''}
              </option>
            ))}
          </select>
        </Field>
        <Segmented name="g-source" legend="Origine de l’accès" value={source} onChange={setSource} options={SOURCES} />
        <div className="row wrap adm-modal-actions">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button type="submit" loading={busy} disabled={!formationId}>
            Donner accès
          </Button>
        </div>
      </form>
    </Modal>
  )
}
