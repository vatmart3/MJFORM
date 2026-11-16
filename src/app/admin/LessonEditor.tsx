// Éditeur d'une leçon : type, contenu Markdown avec aperçu, vidéo, diaporama, ressources.
import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, ExternalLink, FileText, Link2, Paperclip, Trash2, Upload } from 'lucide-react'
import { useBackend } from '../state'
import { useToast } from '../ui/toast'
import { Button, EmptyState, Page, Skeleton } from '../ui/kit'
import { Markdown } from '../ui/markdown'
import type { LessonContent, LessonKind, PublishStatus, Resource } from '../data/types'
import { ConfirmModal, Field, Segmented, errorText, fileSize, useLoad } from './shared'
import { KINDS } from './Outline'

interface Draft {
  title: string
  kind: LessonKind
  durationMin: string
  status: PublishStatus
  completedByWorkshop: boolean
  body: string
  videoUrl: string
  slidesUrl: string
  allowDownload: boolean
  resources: Resource[]
}

const toDraft = (l: LessonContent): Draft => ({
  title: l.title,
  kind: l.kind,
  durationMin: String(l.durationMin ?? 0),
  status: l.status,
  completedByWorkshop: !!l.completedByWorkshop,
  body: l.body ?? '',
  videoUrl: l.videoUrl ?? '',
  slidesUrl: l.slidesUrl ?? '',
  allowDownload: !!l.allowDownload,
  resources: (l.resources ?? []).map((r) => ({ ...r })),
})

const rid = () => `res-${Math.random().toString(36).slice(2, 10)}`

export function LessonEditor() {
  const { id = '', lessonId = '' } = useParams()
  return <Editor key={lessonId} formationId={id} lessonId={lessonId} />
}

function Editor({ formationId, lessonId }: { formationId: string; lessonId: string }) {
  const backend = useBackend()
  const { admin } = backend
  const toast = useToast()
  const navigate = useNavigate()
  const back = `/admin/formations/${formationId}`

  const { data, error } = useLoad(async () => {
    const [lesson, formations] = await Promise.all([admin.getLesson(lessonId), admin.listFormations()])
    const f = formations.find((x) => x.id === formationId)
    const mod = f?.modules.find((m) => m.id === lesson.moduleId)
    return { lesson, formationTitle: f?.title ?? 'Formation', moduleTitle: mod?.title ?? '' }
  }, [admin, lessonId, formationId])

  const [draft, setDraft] = useState<Draft | null>(null)
  const [base, setBase] = useState<Draft | null>(null)
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({})
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'write' | 'preview'>('write')
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (data && !draft) {
    const d = toDraft(data.lesson)
    setDraft(d)
    setBase(d)
  }
  const dirty = useMemo(() => !!draft && JSON.stringify(draft) !== JSON.stringify(base), [draft, base])

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft((d) => (d ? { ...d, [k]: v } : d))
    setErrors((e) => ({ ...e, [k]: undefined }))
  }
  const setResource = (i: number, patch: Partial<Resource>) =>
    setDraft((d) => (d ? { ...d, resources: d.resources.map((r, j) => (j === i ? { ...r, ...patch } : r)) } : d))

  async function upload(file: File) {
    return admin.uploadAsset(formationId, file)
  }

  async function save(e?: FormEvent) {
    e?.preventDefault()
    if (!draft || !data) return
    const errs: typeof errors = {}
    const duration = Number(draft.durationMin)
    if (!draft.title.trim()) errs.title = 'Indiquez un titre.'
    if (!Number.isInteger(duration) || duration < 0) errs.durationMin = 'Indiquez un nombre entier de minutes.'
    if (draft.status === 'published' && draft.kind === 'video' && !draft.videoUrl.trim()) errs.videoUrl = 'Une leçon vidéo publiée doit avoir une vidéo.'
    if (draft.status === 'published' && draft.kind === 'slides' && !draft.slidesUrl.trim()) errs.slidesUrl = 'Un diaporama publié doit avoir son PDF.'
    if (draft.resources.some((r) => !r.name.trim() || !r.url.trim())) errs.resources = 'Chaque ressource doit avoir un nom et une adresse.'
    setErrors(errs)
    if (Object.keys(errs).length) {
      toast('Vérifiez les champs signalés.', 'error')
      return
    }
    setSaving(true)
    try {
      await admin.saveLesson({
        id: data.lesson.id,
        moduleId: data.lesson.moduleId,
        title: draft.title.trim(),
        kind: draft.kind,
        durationMin: duration,
        status: draft.status,
        completedByWorkshop: draft.completedByWorkshop,
        body: draft.body,
        videoUrl: draft.videoUrl.trim() || null,
        slidesUrl: draft.slidesUrl.trim() || null,
        allowDownload: draft.allowDownload,
        resources: draft.resources.map((r) => ({ ...r, name: r.name.trim(), url: r.url.trim() })),
      })
      setBase(draft)
      toast('Leçon enregistrée')
    } catch (err) {
      toast(errorText(err), 'error')
    } finally {
      setSaving(false)
    }
  }

  const kicker = (
    <Link to={back} className="adm-back">
      <ArrowLeft aria-hidden="true" />
      {data?.formationTitle ?? 'Formation'}
    </Link>
  )

  if (error) {
    return (
      <Page kicker={kicker} title="Leçon introuvable">
        <EmptyState
          icon={<FileText />}
          title="Cette leçon n’existe plus"
          text={error}
          action={
            <Link className="btn btn-primary" to={back}>
              Retour au programme
            </Link>
          }
        />
      </Page>
    )
  }
  if (!data || !draft) {
    return (
      <div className="stack-lg" aria-busy="true" aria-label="Chargement de la leçon">
        <div className="stack" style={{ gap: 10 }}>
          <Skeleton h={14} w={160} />
          <Skeleton h={40} w="50%" />
        </div>
        <Skeleton h={260} r={20} />
        <Skeleton h={320} r={20} />
      </div>
    )
  }

  const demo = backend.mode === 'demo'

  return (
    <Page kicker={kicker} title={draft.title.trim() || 'Sans titre'} sub={data.moduleTitle ? `Module « ${data.moduleTitle} »` : undefined}>
      <form className="stack-lg adm-form" onSubmit={save} noValidate>
        <section className="panel stack" aria-labelledby="l-general">
          <h2 className="section-title" id="l-general">
            Généralités
          </h2>
          <Field id="l-title" label="Titre" error={errors.title}>
            <input id="l-title" className="input" value={draft.title} onChange={(e) => set('title', e.target.value)} aria-invalid={errors.title ? true : undefined} />
          </Field>
          <Segmented
            name="kind"
            legend="Type de leçon"
            value={draft.kind}
            onChange={(v) => set('kind', v)}
            options={(Object.keys(KINDS) as LessonKind[]).map((k) => {
              const K = KINDS[k]
              return { value: k, label: K.label, icon: <K.icon aria-hidden="true" /> }
            })}
          />
          <div className="adm-grid-2">
            <Field id="l-duration" label="Durée (minutes)" error={errors.durationMin}>
              <input
                id="l-duration"
                className="input"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={draft.durationMin}
                onChange={(e) => set('durationMin', e.target.value)}
                aria-invalid={errors.durationMin ? true : undefined}
              />
            </Field>
            <Segmented
              name="lstatus"
              legend="Statut"
              value={draft.status}
              onChange={(v) => set('status', v)}
              options={[
                { value: 'draft', label: 'Brouillon' },
                { value: 'published', label: 'Publiée' },
              ]}
            />
          </div>
          <label className="check">
            <input type="checkbox" checked={draft.completedByWorkshop} onChange={(e) => set('completedByWorkshop', e.target.checked)} aria-describedby="l-cbw-hint" />
            <span>
              Validée d’office par l’atelier
              <span className="hint small muted" id="l-cbw-hint" style={{ display: 'block' }}>
                Marquée comme terminée pour les participants qui reçoivent l’accès via l’atelier en présentiel.
              </span>
            </span>
          </label>
        </section>

        <section className="panel stack" aria-labelledby="l-body">
          <div className="row between wrap">
            <h2 className="section-title" id="l-body" style={{ margin: 0 }}>
              Texte de la leçon
            </h2>
            <div className="adm-md-toggle">
              <Segmented
                name="mdview"
                legend="Affichage"
                hideLegend
                value={view}
                onChange={setView}
                options={[
                  { value: 'write', label: 'Écrire' },
                  { value: 'preview', label: 'Aperçu' },
                ]}
              />
            </div>
          </div>
          <div className="adm-md" data-view={view}>
            <div className="field adm-md-write">
              <label htmlFor="l-body-input">Contenu (Markdown)</label>
              <textarea id="l-body-input" className="textarea adm-mono" rows={16} value={draft.body} onChange={(e) => set('body', e.target.value)} aria-describedby="l-body-hint" />
              <span className="hint" id="l-body-hint">
                ## Titre, ### Sous-titre, - liste, 1. liste numérotée, **gras**, *italique*, [lien](https://…)
              </span>
            </div>
            <div className="adm-md-preview" aria-label="Aperçu du texte">
              <span className="label adm-overline">Aperçu</span>
              <div className="adm-preview-box">{draft.body.trim() ? <Markdown source={draft.body} /> : <p className="muted small">L’aperçu s’affiche ici pendant la saisie.</p>}</div>
            </div>
          </div>
        </section>

        <section className="panel stack" aria-labelledby="l-media">
          <h2 className="section-title" id="l-media">
            Supports
          </h2>
          {demo ? <p className="small muted" style={{ margin: 0 }}>Mode démo : un fichier téléversé reste dans cet onglet et n’est envoyé nulle part.</p> : null}
          <MediaField
            id="l-video"
            label={draft.kind === 'video' ? 'Vidéo' : 'Vidéo (facultatif)'}
            accept="video/*"
            value={draft.videoUrl}
            error={errors.videoUrl}
            placeholder="https://… ou chemin du fichier"
            onChange={(v) => set('videoUrl', v)}
            upload={upload}
          />
          <MediaField
            id="l-slides"
            label={draft.kind === 'slides' ? 'Diaporama PDF' : 'Diaporama PDF (facultatif)'}
            accept="application/pdf"
            value={draft.slidesUrl}
            error={errors.slidesUrl}
            placeholder="https://…/support.pdf"
            onChange={(v) => set('slidesUrl', v)}
            upload={upload}
          />
          <label className="check">
            <input type="checkbox" checked={draft.allowDownload} onChange={(e) => set('allowDownload', e.target.checked)} />
            <span>Autoriser le téléchargement du support</span>
          </label>
        </section>

        <section className="panel stack" aria-labelledby="l-res">
          <div>
            <h2 className="section-title" id="l-res" style={{ marginBottom: 4 }}>
              Ressources
            </h2>
            <p className="small muted" style={{ margin: 0 }}>
              Fichiers ou liens proposés sous la leçon : modèles, consignes, fiches pratiques.
            </p>
          </div>
          {draft.resources.length ? (
            <ul className="adm-res-list">
              {draft.resources.map((r, i) => (
                <li key={r.id} className="adm-res">
                  <Paperclip className="adm-kind" aria-hidden="true" />
                  <div className="adm-res-fields">
                    <label className="sr-only" htmlFor={`${r.id}-name`}>
                      Nom de la ressource {i + 1}
                    </label>
                    <input id={`${r.id}-name`} className="input" placeholder="Nom affiché" value={r.name} onChange={(e) => setResource(i, { name: e.target.value })} />
                    <label className="sr-only" htmlFor={`${r.id}-url`}>
                      Adresse de la ressource {i + 1}
                    </label>
                    <input id={`${r.id}-url`} className="input adm-mono" placeholder="https://…" value={r.url} onChange={(e) => setResource(i, { url: e.target.value })} />
                  </div>
                  <button
                    type="button"
                    className="icon-btn adm-danger-icon"
                    aria-label={`Retirer la ressource ${r.name || i + 1}`}
                    onClick={() => setDraft((d) => (d ? { ...d, resources: d.resources.filter((_, j) => j !== i) } : d))}
                  >
                    <Trash2 />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {errors.resources ? (
            <p className="err small" role="alert" style={{ margin: 0, color: 'var(--danger)' }}>
              {errors.resources}
            </p>
          ) : null}
          <div className="row wrap" style={{ gap: 8 }}>
            <Button variant="ghost" size="sm" onClick={() => setDraft((d) => (d ? { ...d, resources: [...d.resources, { id: rid(), name: '', url: '' }] } : d))}>
              <Link2 aria-hidden="true" />
              Ajouter un lien
            </Button>
            <UploadButton
              label="Téléverser un fichier"
              onFile={async (file) => {
                const url = await upload(file)
                setDraft((d) => (d ? { ...d, resources: [...d.resources, { id: rid(), name: file.name, url, size: fileSize(file.size) }] } : d))
                toast('Fichier ajouté aux ressources')
              }}
            />
          </div>
        </section>

        <div className="adm-savebar">
          <span className="small muted" aria-live="polite">
            {dirty ? 'Modifications non enregistrées' : 'Tout est enregistré'}
          </span>
          <Button type="submit" loading={saving} disabled={!dirty && !saving}>
            Enregistrer la leçon
          </Button>
        </div>
      </form>

      <section className="adm-danger" aria-labelledby="l-danger" style={{ marginTop: 32 }}>
        <div>
          <h2 className="section-title" id="l-danger" style={{ marginBottom: 4 }}>
            Supprimer la leçon
          </h2>
          <p className="muted small" style={{ margin: 0 }}>
            La progression des clients sur cette leçon est aussi supprimée.
          </p>
        </div>
        <Button variant="danger" onClick={() => setConfirmDelete(true)}>
          <Trash2 aria-hidden="true" />
          Supprimer
        </Button>
      </section>

      <ConfirmModal
        open={confirmDelete}
        title="Supprimer cette leçon ?"
        text={`« ${data.lesson.title} » sera supprimée définitivement.`}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          try {
            await admin.deleteLesson(data.lesson.id)
            toast('Leçon supprimée')
            navigate(back, { replace: true })
          } catch (err) {
            toast(errorText(err), 'error')
          }
        }}
      />
    </Page>
  )
}

/** Adresse d'un média, saisie à la main ou obtenue par téléversement. */
function MediaField({
  id,
  label,
  accept,
  value,
  error,
  placeholder,
  onChange,
  upload,
}: {
  id: string
  label: string
  accept: string
  value: string
  error?: string
  placeholder: string
  onChange: (v: string) => void
  upload: (f: File) => Promise<string>
}) {
  const toast = useToast()
  return (
    <Field id={id} label={label} error={error}>
      <div className="adm-media">
        <input id={id} className="input adm-mono" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-err` : undefined} />
        <UploadButton
          label="Téléverser"
          describedLabel={`Téléverser un fichier pour : ${label}`}
          accept={accept}
          onFile={async (file) => {
            onChange(await upload(file))
            toast('Fichier téléversé')
          }}
        />
      </div>
      {value ? (
        <a className="small adm-open" href={value} target="_blank" rel="noopener noreferrer">
          <ExternalLink aria-hidden="true" />
          Ouvrir le fichier
        </a>
      ) : null}
    </Field>
  )
}

/** Bouton qui ouvre le sélecteur de fichier (champ natif masqué). */
function UploadButton({ label, describedLabel, accept, onFile }: { label: string; describedLabel?: string; accept?: string; onFile: (f: File) => Promise<void> }) {
  const input = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={accept}
        hidden
        tabIndex={-1}
        aria-hidden="true"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          setBusy(true)
          try {
            await onFile(file)
          } catch (err) {
            toast(errorText(err), 'error')
          } finally {
            setBusy(false)
          }
        }}
      />
      <Button variant="ghost" size="sm" loading={busy} onClick={() => input.current?.click()} aria-label={describedLabel}>
        {busy ? null : <Upload aria-hidden="true" />}
        {busy ? 'Envoi…' : label}
      </Button>
    </>
  )
}

