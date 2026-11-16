// Profil : identité, photo, notifications, factures, déconnexion, suppression du compte (RGPD).
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Camera, Download, FileText, LogOut, Trash2 } from 'lucide-react'
import { formatDate, formatEuro } from '../data/logic'
import type { Invoice } from '../data/types'
import { useBackend, useSession } from '../state'
import { Avatar, Button, Modal, Page, Skeleton } from '../ui/kit'
import { useToast } from '../ui/toast'
import { PageSkeleton } from './common'

export function Profil() {
  const { user } = useSession()
  const backend = useBackend()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState(() => ({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    company: user?.company ?? '',
    activity: user?.activity ?? '',
    phone: user?.phone ?? '',
    notifyEmail: user?.notifyEmail ?? true,
    notifySms: user?.notifySms ?? false,
  }))
  const [saving, setSaving] = useState(false)
  const [invoices, setInvoices] = useState<Invoice[] | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [typed, setTyped] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    backend.listInvoices().then(setInvoices).catch(() => setInvoices([]))
  }, [backend])

  if (!user) return <PageSkeleton />

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await backend.updateProfile(form)
      toast('Profil enregistré')
    } catch {
      toast('Enregistrement impossible. Réessayez.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const onAvatar = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast('Choisissez une image (JPG ou PNG).', 'error')
      return
    }
    try {
      await backend.uploadAvatar(file)
      toast('Photo mise à jour')
    } catch {
      toast('Envoi de la photo impossible.', 'error')
    }
  }

  const remove = async () => {
    setDeleting(true)
    try {
      await backend.deleteAccount()
    } catch {
      toast('Suppression impossible. Écrivez-nous.', 'error')
      setDeleting(false)
    }
  }

  const name = `${user.firstName} ${user.lastName}`.trim()

  return (
    <Page kicker="Profil" title="Vos informations.">
      <div className="profile-grid">
        <form className="stack" onSubmit={save} aria-labelledby="id-title">
          <h2 id="id-title" className="section-title">
            Identité
          </h2>
          <div className="row" style={{ gap: 16 }}>
            <Avatar name={name || user.email} url={user.avatarUrl} size={72} />
            <div>
              <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()}>
                <Camera aria-hidden="true" /> Changer la photo
              </Button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onAvatar(e.target.files?.[0])} />
            </div>
          </div>
          <div className="two">
            <div className="field">
              <label htmlFor="fn">Prénom</label>
              <input id="fn" className="input" autoComplete="given-name" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ln">Nom</label>
              <input id="ln" className="input" autoComplete="family-name" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
            </div>
          </div>
          <div className="two">
            <div className="field">
              <label htmlFor="co">Entreprise</label>
              <input id="co" className="input" autoComplete="organization" value={form.company} onChange={(e) => set('company', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ac">Activité</label>
              <input id="ac" className="input" placeholder="Boulangerie, restaurant, fleuriste…" value={form.activity} onChange={(e) => set('activity', e.target.value)} />
            </div>
          </div>
          <div className="two">
            <div className="field">
              <label htmlFor="em">E-mail</label>
              <input id="em" className="input" value={user.email} readOnly aria-describedby="em-hint" />
              <span id="em-hint" className="hint">
                Pour le changer, écrivez-nous.
              </span>
            </div>
            <div className="field">
              <label htmlFor="ph">Téléphone</label>
              <input id="ph" className="input" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
          </div>
          <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 0 }}>
            <legend className="section-title" style={{ marginTop: 12 }}>
              Notifications
            </legend>
            <label className="check">
              <input type="checkbox" checked={form.notifyEmail} onChange={(e) => set('notifyEmail', e.target.checked)} />
              <span>
                Par e-mail
                <span className="tiny muted" style={{ display: 'block' }}>
                  Nouvelles leçons, prochains ateliers, récompenses de parrainage.
                </span>
              </span>
            </label>
            <label className="check">
              <input type="checkbox" checked={form.notifySms} onChange={(e) => set('notifySms', e.target.checked)} />
              <span>
                Par SMS
                <span className="tiny muted" style={{ display: 'block' }}>
                  Rappel la veille de vos ateliers.
                </span>
              </span>
            </label>
          </fieldset>
          <div>
            <Button type="submit" loading={saving}>
              Enregistrer
            </Button>
          </div>
        </form>

        <div className="stack-lg">
          <section aria-labelledby="inv-title">
            <h2 id="inv-title" className="section-title">
              Factures
            </h2>
            {invoices === null ? (
              <Skeleton h={56} r={14} />
            ) : invoices.length === 0 ? (
              <p className="muted small" style={{ margin: 0 }}>
                Aucune facture pour l’instant.
              </p>
            ) : (
              <ul className="invoices">
                {invoices.map((inv) => (
                  <li key={inv.id}>
                    <FileText aria-hidden="true" />
                    <span>
                      <strong>{inv.label}</strong>
                      <span className="tiny muted" style={{ display: 'block' }}>
                        {formatDate(inv.date)} · {formatEuro(inv.amount)}
                      </span>
                    </span>
                    {inv.url ? (
                      <a className="icon-btn" href={inv.url} target="_blank" rel="noopener" aria-label={`Télécharger la facture ${inv.label}`}>
                        <Download />
                      </a>
                    ) : (
                      <span className="tiny muted">{backend.mode === 'demo' ? 'Démo' : 'Envoyée par e-mail'}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="stack" aria-labelledby="acc-title">
            <h2 id="acc-title" className="section-title" style={{ margin: 0 }}>
              Compte
            </h2>
            <div>
              <Button variant="ghost" onClick={() => backend.signOut()}>
                <LogOut aria-hidden="true" /> Se déconnecter
              </Button>
            </div>
            <div>
              <Button variant="danger" onClick={() => setConfirm(true)}>
                <Trash2 aria-hidden="true" /> Supprimer mon compte
              </Button>
              <p className="tiny muted" style={{ margin: '8px 0 0' }}>
                Vos données personnelles sont effacées. Vos factures restent conservées par Stripe, comme l’exige la loi.
              </p>
            </div>
          </section>
        </div>
      </div>

      <Modal open={confirm} onClose={() => !deleting && setConfirm(false)} title="Supprimer votre compte ?">
        <div className="stack">
          <p className="muted" style={{ margin: 0 }}>
            Vous perdrez l’accès à vos formations et à votre progression. Cette action est définitive.
          </p>
          <div className="field">
            <label htmlFor="confirm-del">Tapez SUPPRIMER pour confirmer</label>
            <input id="confirm-del" className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </div>
          <Button variant="danger" block disabled={typed.trim().toUpperCase() !== 'SUPPRIMER'} loading={deleting} onClick={remove}>
            Supprimer définitivement
          </Button>
        </div>
      </Modal>
    </Page>
  )
}
