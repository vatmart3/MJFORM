// Éditeur d'une formation : fiche (titre, prix, statut…) et programme (modules et leçons).
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, BookOpen, Trash2 } from 'lucide-react'
import { useBackend } from '../state'
import { useToast } from '../ui/toast'
import { Button, EmptyState, Page, Skeleton } from '../ui/kit'
import type { Formation, Level, PublishStatus } from '../data/types'
import { ConfirmModal, Field, Segmented, errorText, slugify, useLoad } from './shared'
import { Outline } from './Outline'
import { StatusBadge } from './Formations'

interface Draft {
  title: string
  subtitle: string
  description: string
  level: Level
  duration: string
  price: string
  benefits: string
  status: PublishStatus
  slug: string
}

const toDraft = (f: Formation): Draft => ({
  title: f.title,
  subtitle: f.subtitle,
  description: f.description,
  level: f.level,
  duration: f.duration,
  price: String(f.price ?? 0).replace('.', ','),
  benefits: f.benefits.join('\n'),
  status: f.status,
  slug: f.slug,
})

const LEVELS: Level[] = ['Initiation', 'Intermédiaire', 'Avancé']

export function FormationEditor() {
  const { id = '' } = useParams()
  return <Editor key={id} id={id} />
}

function Editor({ id }: { id: string }) {
  const { admin } = useBackend()
  const toast = useToast()
  const navigate = useNavigate()
  const { data: formation, error, reload, setData } = useLoad(async () => {
    const all = await admin.listFormations()
    const f = all.find((x) => x.id === id)
    if (!f) throw new Error('not-found')
    return f
  }, [admin, id])

  const [draft, setDraft] = useState<Draft | null>(null)
  const [base, setBase] = useState<Draft | null>(null)
  const [slugTouched, setSlugTouched] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({})
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Le formulaire n'est initialisé qu'au premier chargement (les rechargements du programme ne l'écrasent pas)
  useEffect(() => {
    if (formation && !draft) {
      const d = toDraft(formation)
      setDraft(d)
      setBase(d)
      setSlugTouched(formation.slug !== slugify(formation.title))
    }
  }, [formation]) // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = useMemo(() => !!draft && !!base && JSON.stringify(draft) !== JSON.stringify(base), [draft, base])

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft((d) => {
      if (!d) return d
      const next = { ...d, [k]: v }
      if (k === 'title' && !slugTouched) next.slug = slugify(String(v))
      return next
    })
    setErrors((e) => ({ ...e, [k]: undefined }))
  }

  async function save(e?: FormEvent) {
    e?.preventDefault()
    if (!draft || !formation) return
    const errs: typeof errors = {}
    const price = Number(draft.price.replace(',', '.').replace(/\s/g, ''))
    if (!draft.title.trim()) errs.title = 'Indiquez un titre.'
    if (!Number.isFinite(price) || price < 0) errs.price = 'Indiquez un prix valide, par exemple 49 ou 49,90.'
    if (!draft.slug.trim()) errs.slug = 'Indiquez un identifiant.'
    setErrors(errs)
    if (Object.keys(errs).length) {
      toast('Vérifiez les champs signalés.', 'error')
      return
    }
    setSaving(true)
    try {
      const saved = await admin.saveFormation({
        id: formation.id,
        title: draft.title.trim(),
        subtitle: draft.subtitle.trim(),
        description: draft.description.trim(),
        level: draft.level,
        duration: draft.duration.trim(),
        price: Math.round(price * 100) / 100,
        benefits: draft.benefits
          .split('\n')
          .map((b) => b.trim())
          .filter(Boolean),
        status: draft.status,
        slug: slugify(draft.slug),
      })
      const d = toDraft({ ...formation, ...saved, modules: formation.modules })
      setDraft(d)
      setBase(d)
      setData((f) => (f ? { ...f, ...saved, modules: f.modules } : f))
      toast(saved.status === 'published' ? 'Formation enregistrée et publiée' : 'Formation enregistrée (brouillon)')
    } catch (err) {
      toast(errorText(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  if (error) {
    return (
      <Page kicker={<BackLink />} title="Formation introuvable">
        <EmptyState
          icon={<BookOpen />}
          title="Cette formation n’existe plus"
          text={error}
          action={
            <Link className="btn btn-primary" to="/admin/formations">
              Retour aux formations
            </Link>
          }
        />
      </Page>
    )
  }

  if (!formation || !draft) {
    return (
      <div className="stack-lg" aria-busy="true" aria-label="Chargement de la formation">
        <div className="stack" style={{ gap: 10 }}>
          <Skeleton h={14} w={120} />
          <Skeleton h={40} w="55%" />
        </div>
        <Skeleton h={320} r={20} />
        <Skeleton h={200} r={20} />
      </div>
    )
  }

  return (
    <Page
      kicker={<BackLink />}
      title={draft.title.trim() || 'Sans titre'}
      sub={
        <span className="row wrap" style={{ gap: 8 }}>
          <StatusBadge status={base?.status ?? 'draft'} />
          {dirty ? <span className="small">Modifications non enregistrées</span> : null}
        </span>
      }
    >
      <div className="stack-lg">
        <form className="panel stack adm-form" onSubmit={save} noValidate aria-labelledby="fiche-title">
          <h2 className="section-title" id="fiche-title">
            Fiche
          </h2>
          <Segmented
            name="status"
            legend="Statut"
            value={draft.status}
            onChange={(v) => set('status', v)}
            options={[
              { value: 'draft', label: 'Brouillon' },
              { value: 'published', label: 'Publié' },
            ]}
          />
          <p className="hint small muted" style={{ margin: '-6px 0 0' }}>
            {draft.status === 'published'
              ? 'Visible dans l’espace client après enregistrement. Seules les leçons publiées y apparaissent.'
              : 'Invisible pour les clients tant qu’elle reste en brouillon.'}
          </p>

          <Field id="f-title" label="Titre" error={errors.title}>
            <input id="f-title" className="input" value={draft.title} onChange={(e) => set('title', e.target.value)} aria-invalid={errors.title ? true : undefined} />
          </Field>
          <Field id="f-subtitle" label="Sous-titre">
            <input id="f-subtitle" className="input" value={draft.subtitle} onChange={(e) => set('subtitle', e.target.value)} />
          </Field>
          <Field id="f-description" label="Description">
            <textarea id="f-description" className="textarea" rows={4} value={draft.description} onChange={(e) => set('description', e.target.value)} />
          </Field>

          <div className="adm-grid-3">
            <Field id="f-level" label="Niveau">
              <select id="f-level" className="select" value={draft.level} onChange={(e) => set('level', e.target.value as Level)}>
                {LEVELS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </Field>
            <Field id="f-duration" label="Durée" hint="Ex. 3 h ou 6 semaines">
              <input id="f-duration" className="input" value={draft.duration} onChange={(e) => set('duration', e.target.value)} aria-describedby="f-duration-hint" />
            </Field>
            <Field id="f-price" label="Prix (€)" error={errors.price} hint="Prix net, TVA non applicable">
              <input
                id="f-price"
                className="input"
                inputMode="decimal"
                value={draft.price}
                onChange={(e) => set('price', e.target.value)}
                aria-invalid={errors.price ? true : undefined}
                aria-describedby={errors.price ? 'f-price-err' : 'f-price-hint'}
              />
            </Field>
          </div>

          <Field id="f-benefits" label="Bénéfices" hint="Un bénéfice par ligne, affichés en liste sur la fiche.">
            <textarea id="f-benefits" className="textarea" rows={4} value={draft.benefits} onChange={(e) => set('benefits', e.target.value)} aria-describedby="f-benefits-hint" />
          </Field>

          <Field
            id="f-slug"
            label="Identifiant d’adresse"
            error={errors.slug}
            hint={slugTouched ? 'Personnalisé. Videz le champ pour le recalculer à partir du titre.' : 'Calculé automatiquement à partir du titre.'}
          >
            <input
              id="f-slug"
              className="input adm-mono"
              value={draft.slug}
              onChange={(e) => {
                const v = e.target.value
                setSlugTouched(v.trim() !== '')
                set('slug', v.trim() === '' ? slugify(draft.title) : v)
              }}
              aria-describedby={errors.slug ? 'f-slug-err' : 'f-slug-hint'}
              spellCheck={false}
            />
          </Field>

          <div className="adm-savebar">
            <span className="small muted" aria-live="polite">
              {dirty ? 'Modifications non enregistrées' : 'Tout est enregistré'}
            </span>
            <Button type="submit" loading={saving} disabled={!dirty && !saving}>
              Enregistrer
            </Button>
          </div>
        </form>

        <Outline formation={formation} onChange={setData} reload={reload} />

        <section className="adm-danger" aria-labelledby="danger-title">
          <div>
            <h2 className="section-title" id="danger-title" style={{ marginBottom: 4 }}>
              Supprimer la formation
            </h2>
            <p className="muted small" style={{ margin: 0 }}>
              Ses modules, ses leçons et les accès des clients sont supprimés. Action définitive.
            </p>
          </div>
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 aria-hidden="true" />
            Supprimer
          </Button>
        </section>
      </div>

      <ConfirmModal
        open={confirmDelete}
        title="Supprimer cette formation ?"
        text={`« ${formation.title} », ses ${formation.modules.length} modules et toutes ses leçons seront supprimés, ainsi que les accès des clients. Cette action est définitive.`}
        confirmLabel="Supprimer la formation"
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          try {
            await admin.deleteFormation(formation.id)
            toast('Formation supprimée')
            navigate('/admin/formations', { replace: true })
          } catch (err) {
            toast(errorText(err), 'error')
          }
        }}
      />
    </Page>
  )
}

function BackLink() {
  return (
    <Link to="/admin/formations" className="adm-back">
      <ArrowLeft aria-hidden="true" />
      Formations
    </Link>
  )
}
