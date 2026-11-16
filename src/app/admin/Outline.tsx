// Programme d'une formation : modules et leçons, réorganisables par glisser-déposer
// ou au clavier (boutons monter / descendre).
import { useEffect, useId, useMemo, useRef, useState, type Dispatch, type DragEvent, type FormEvent, type KeyboardEvent, type SetStateAction } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowDown, ArrowUp, Check, FileText, GripVertical, Layers, Pencil, Plus, Presentation, Trash2, Video, X, type LucideIcon } from 'lucide-react'
import { useBackend } from '../state'
import { useToast } from '../ui/toast'
import { Button, EmptyState } from '../ui/kit'
import type { Formation, LessonKind, LessonOutline, Module } from '../data/types'
import { ConfirmModal, errorText, useAnnouncer } from './shared'
import { plural } from './Formations'

export const KINDS: Record<LessonKind, { label: string; icon: LucideIcon }> = {
  video: { label: 'Vidéo', icon: Video },
  slides: { label: 'Diaporama PDF', icon: Presentation },
  text: { label: 'Texte', icon: FileText },
}

type Drag = { kind: 'module'; id: string } | { kind: 'lesson'; id: string; moduleId: string }
type Pending = { kind: 'module' | 'lesson'; id: string; title: string; count: number } | null

const byPos = <T extends { position: number }>(a: T, b: T) => a.position - b.position
const swap = (ids: string[], i: number, j: number) => {
  const next = [...ids]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}
const moveTo = (ids: string[], from: number, to: number) => {
  const next = [...ids]
  const [x] = next.splice(from, 1)
  next.splice(to, 0, x)
  return next
}

export function Outline({ formation, onChange, reload }: { formation: Formation; onChange: Dispatch<SetStateAction<Formation | null>>; reload: () => Promise<unknown> }) {
  const { admin } = useBackend()
  const toast = useToast()
  const navigate = useNavigate()
  const { announce, node: liveRegion } = useAnnouncer()

  const modules = useMemo(() => [...formation.modules].sort(byPos).map((m) => ({ ...m, lessons: [...m.lessons].sort(byPos) })), [formation.modules])
  const modulesRef = useRef(modules)
  modulesRef.current = modules

  const drag = useRef<Drag | null>(null)
  const startOrder = useRef<string[]>([])
  const [dragId, setDragId] = useState<string | null>(null)
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null)
  const [pending, setPending] = useState<Pending>(null)

  // Après un déplacement au clavier, le focus reste sur le bouton utilisé
  useEffect(() => {
    if (!focusKey) return
    document.querySelector<HTMLElement>(`[data-focus="${focusKey}"]`)?.focus()
    setFocusKey(null)
  }, [focusKey])

  // ——— Mise à jour locale de l'ordre ———
  const applyModules = (ids: string[]) =>
    onChange((f) => f && { ...f, modules: ids.map((id, i) => ({ ...f.modules.find((m) => m.id === id)!, position: i })) })
  const applyLessons = (moduleId: string, ids: string[]) =>
    onChange(
      (f) =>
        f && {
          ...f,
          modules: f.modules.map((m) => (m.id === moduleId ? { ...m, lessons: ids.map((id, i) => ({ ...m.lessons.find((l) => l.id === id)!, position: i })) } : m)),
        },
    )
  async function persist(kind: 'module' | 'lesson', ids: string[]) {
    try {
      await admin.reorder(kind, ids)
    } catch (e) {
      toast(errorText(e), 'error')
      reload()
    }
  }

  // ——— Clavier / tactile ———
  function moveModule(m: Module, dir: -1 | 1) {
    const ids = modulesRef.current.map((x) => x.id)
    const i = ids.indexOf(m.id)
    const j = i + dir
    if (j < 0 || j >= ids.length) return
    const next = swap(ids, i, j)
    applyModules(next)
    persist('module', next)
    announce(`Module « ${m.title} » déplacé en position ${j + 1} sur ${ids.length}.`)
    setFocusKey(`m-${m.id}-${dir < 0 ? 'up' : 'down'}`)
  }
  function moveLesson(l: LessonOutline, dir: -1 | 1) {
    const mod = modulesRef.current.find((m) => m.id === l.moduleId)
    if (!mod) return
    const ids = mod.lessons.map((x) => x.id)
    const i = ids.indexOf(l.id)
    const j = i + dir
    if (j < 0 || j >= ids.length) return
    const next = swap(ids, i, j)
    applyLessons(mod.id, next)
    persist('lesson', next)
    announce(`Leçon « ${l.title} » déplacée en position ${j + 1} sur ${ids.length}.`)
    setFocusKey(`l-${l.id}-${dir < 0 ? 'up' : 'down'}`)
  }

  // ——— Glisser-déposer (HTML5) ———
  function startDrag(e: DragEvent, d: Drag, order: string[]) {
    e.stopPropagation()
    drag.current = d
    startOrder.current = order
    setDragId(d.id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', d.id)
  }
  /** Ne déplace qu'une fois la moitié de la cible franchie, pour éviter les va-et-vient */
  const passedHalf = (e: DragEvent, from: number, to: number) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const after = e.clientY > r.top + r.height / 2
    return (from < to && after) || (from > to && !after)
  }
  function overModule(e: DragEvent, targetId: string) {
    const d = drag.current
    if (!d || d.kind !== 'module') return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (d.id === targetId) return
    const ids = modulesRef.current.map((m) => m.id)
    const from = ids.indexOf(d.id)
    const to = ids.indexOf(targetId)
    if (passedHalf(e, from, to)) applyModules(moveTo(ids, from, to))
  }
  function overLesson(e: DragEvent, target: LessonOutline) {
    const d = drag.current
    if (!d || d.kind !== 'lesson' || d.moduleId !== target.moduleId) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    if (d.id === target.id) return
    const ids = modulesRef.current.find((m) => m.id === target.moduleId)!.lessons.map((l) => l.id)
    const from = ids.indexOf(d.id)
    const to = ids.indexOf(target.id)
    if (passedHalf(e, from, to)) applyLessons(target.moduleId, moveTo(ids, from, to))
  }
  function endDrag() {
    const d = drag.current
    drag.current = null
    setDragId(null)
    if (!d) return
    const ids = d.kind === 'module' ? modulesRef.current.map((m) => m.id) : (modulesRef.current.find((m) => m.id === d.moduleId)?.lessons.map((l) => l.id) ?? [])
    if (ids.join() !== startOrder.current.join()) {
      persist(d.kind, ids)
      announce(d.kind === 'module' ? 'Ordre des modules enregistré.' : 'Ordre des leçons enregistré.')
    }
  }

  // ——— Création, renommage, suppression ———
  async function addModule(title: string) {
    const position = Math.max(-1, ...modulesRef.current.map((m) => m.position)) + 1
    await admin.saveModule({ formationId: formation.id, title, position })
    await reload()
    toast('Module ajouté')
  }
  async function addLesson(m: Module, title: string) {
    const position = Math.max(-1, ...m.lessons.map((l) => l.position)) + 1
    const id = await admin.saveLesson({
      moduleId: m.id,
      title,
      kind: 'text',
      durationMin: 10,
      status: 'draft',
      position,
      body: '',
      videoUrl: null,
      slidesUrl: null,
      allowDownload: false,
      resources: [],
    })
    toast('Leçon ajoutée : complétez son contenu')
    navigate(`/admin/formations/${formation.id}/lecons/${id}`)
  }
  async function rename(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    const title = editing.title.trim()
    if (!title) return
    try {
      await admin.saveModule({ id: editing.id, formationId: formation.id, title })
      onChange((f) => f && { ...f, modules: f.modules.map((m) => (m.id === editing.id ? { ...m, title } : m)) })
      setFocusKey(`m-${editing.id}-rename`)
      setEditing(null)
      toast('Module renommé')
    } catch (err) {
      toast(errorText(err), 'error')
    }
  }

  return (
    <section className="stack" aria-labelledby="programme-title">
      <div className="row between wrap" style={{ alignItems: 'flex-end' }}>
        <div>
          <h2 className="section-title" id="programme-title" style={{ marginBottom: 4 }}>
            Programme
          </h2>
          <p className="muted small" style={{ margin: 0 }}>
            Glissez-déposez pour réorganiser, ou utilisez les flèches. Chaque changement d’ordre est enregistré aussitôt.
          </p>
        </div>
      </div>
      {liveRegion}

      {modules.length === 0 ? (
        <EmptyState
          icon={<Layers />}
          title="Aucun module pour l’instant"
          text="Un module regroupe plusieurs leçons, par exemple « Les bases » ou « Cas pratiques ». Commencez par en créer un."
          action={<InlineAdd label="Ajouter un module" inputLabel="Titre du module" placeholder="Ex. Les bases" onAdd={addModule} />}
        />
      ) : (
        <ol className="adm-modules">
          {modules.map((m, mi) => {
            const isEditing = editing?.id === m.id
            return (
              <li key={m.id} className={`adm-module${dragId === m.id ? ' is-dragging' : ''}`} onDragOver={(e) => overModule(e, m.id)} onDrop={(e) => e.preventDefault()}>
                <div
                  className="adm-module-head"
                  draggable={!isEditing}
                  onDragStart={(e) =>
                    startDrag(
                      e,
                      { kind: 'module', id: m.id },
                      modules.map((x) => x.id),
                    )
                  }
                  onDragEnd={endDrag}
                >
                  <span className="adm-grip" aria-hidden="true" title="Glisser pour déplacer">
                    <GripVertical />
                  </span>
                  <div className="adm-module-title">
                    <span className="adm-overline">
                      Module {mi + 1} · {plural(m.lessons.length, 'leçon', 'leçons')}
                    </span>
                    {isEditing ? (
                      <form className="adm-inline-form" onSubmit={rename}>
                        <label className="sr-only" htmlFor={`rename-${m.id}`}>
                          Nouveau titre du module
                        </label>
                        <input
                          id={`rename-${m.id}`}
                          className="input"
                          autoFocus
                          value={editing.title}
                          onChange={(e) => setEditing({ id: m.id, title: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              e.stopPropagation()
                              setEditing(null)
                              setFocusKey(`m-${m.id}-rename`)
                            }
                          }}
                        />
                        <button type="submit" className="icon-btn" aria-label="Enregistrer le titre">
                          <Check />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label="Annuler le renommage"
                          onClick={() => {
                            setEditing(null)
                            setFocusKey(`m-${m.id}-rename`)
                          }}
                        >
                          <X />
                        </button>
                      </form>
                    ) : (
                      <h3>{m.title}</h3>
                    )}
                  </div>
                  {!isEditing ? (
                    <div className="adm-actions">
                      <MoveButtons
                        id={`m-${m.id}`}
                        what={`le module « ${m.title} »`}
                        first={mi === 0}
                        last={mi === modules.length - 1}
                        onMove={(d) => moveModule(m, d)}
                      />
                      <button type="button" className="icon-btn" data-focus={`m-${m.id}-rename`} aria-label={`Renommer le module « ${m.title} »`} onClick={() => setEditing({ id: m.id, title: m.title })}>
                        <Pencil />
                      </button>
                      <button
                        type="button"
                        className="icon-btn adm-danger-icon"
                        aria-label={`Supprimer le module « ${m.title} »`}
                        onClick={() => setPending({ kind: 'module', id: m.id, title: m.title, count: m.lessons.length })}
                      >
                        <Trash2 />
                      </button>
                    </div>
                  ) : null}
                </div>

                {m.lessons.length ? (
                  <ol className="adm-lessons">
                    {m.lessons.map((l, li) => {
                      const K = KINDS[l.kind]
                      return (
                        <li
                          key={l.id}
                          className={`adm-lesson${dragId === l.id ? ' is-dragging' : ''}`}
                          draggable
                          onDragStart={(e) =>
                            startDrag(
                              e,
                              { kind: 'lesson', id: l.id, moduleId: m.id },
                              m.lessons.map((x) => x.id),
                            )
                          }
                          onDragOver={(e) => overLesson(e, l)}
                          onDragEnd={endDrag}
                          onDrop={(e) => e.preventDefault()}
                        >
                          <span className="adm-grip" aria-hidden="true">
                            <GripVertical />
                          </span>
                          <K.icon className="adm-kind" aria-hidden="true" />
                          <Link to={`/admin/formations/${formation.id}/lecons/${l.id}`} className="adm-lesson-link" draggable={false}>
                            <span className="adm-lesson-title">{l.title}</span>
                            <span className="tiny muted">
                              {K.label} · {l.durationMin} min
                              {l.completedByWorkshop ? ' · validée par l’atelier' : ''}
                            </span>
                          </Link>
                          {l.status === 'draft' ? <span className="badge adm-hide-xs">Brouillon</span> : null}
                          <div className="adm-actions">
                            <MoveButtons id={`l-${l.id}`} what={`la leçon « ${l.title} »`} first={li === 0} last={li === m.lessons.length - 1} onMove={(d) => moveLesson(l, d)} />
                            <button type="button" className="icon-btn adm-danger-icon" aria-label={`Supprimer la leçon « ${l.title} »`} onClick={() => setPending({ kind: 'lesson', id: l.id, title: l.title, count: 0 })}>
                              <Trash2 />
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                ) : (
                  <p className="small muted adm-module-empty">Aucune leçon dans ce module.</p>
                )}
                <div className="adm-module-foot">
                  <InlineAdd label="Ajouter une leçon" inputLabel={`Titre de la nouvelle leçon du module « ${m.title} »`} placeholder="Titre de la leçon" onAdd={(t) => addLesson(m, t)} />
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {modules.length ? (
        <div>
          <InlineAdd label="Ajouter un module" inputLabel="Titre du module" placeholder="Ex. Cas pratiques" onAdd={addModule} />
        </div>
      ) : null}

      <ConfirmModal
        open={!!pending}
        title={pending?.kind === 'module' ? 'Supprimer ce module ?' : 'Supprimer cette leçon ?'}
        text={
          pending?.kind === 'module'
            ? `Le module « ${pending.title} »${pending.count ? ` et ses ${plural(pending.count, 'leçon', 'leçons')}` : ''} seront supprimés définitivement, ainsi que la progression des clients sur ces leçons.`
            : `La leçon « ${pending?.title ?? ''} » sera supprimée définitivement, ainsi que la progression des clients sur cette leçon.`
        }
        onClose={() => setPending(null)}
        onConfirm={async () => {
          if (!pending) return
          try {
            if (pending.kind === 'module') await admin.deleteModule(pending.id)
            else await admin.deleteLesson(pending.id)
            await reload()
            toast(pending.kind === 'module' ? 'Module supprimé' : 'Leçon supprimée')
            setPending(null)
          } catch (err) {
            toast(errorText(err), 'error')
          }
        }}
      />
    </section>
  )
}

function MoveButtons({ id, what, first, last, onMove }: { id: string; what: string; first: boolean; last: boolean; onMove: (d: -1 | 1) => void }) {
  return (
    <>
      <button type="button" className="icon-btn" data-focus={`${id}-up`} aria-label={`Monter ${what}`} aria-disabled={first || undefined} onClick={() => !first && onMove(-1)}>
        <ArrowUp />
      </button>
      <button type="button" className="icon-btn" data-focus={`${id}-down`} aria-label={`Descendre ${what}`} aria-disabled={last || undefined} onClick={() => !last && onMove(1)}>
        <ArrowDown />
      </button>
    </>
  )
}

/** Bouton « Ajouter… » qui se transforme en champ de saisie. */
export function InlineAdd({ label, inputLabel, placeholder, onAdd }: { label: string; inputLabel: string; placeholder?: string; onAdd: (title: string) => Promise<void> }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const inputId = useId()

  const close = () => {
    setOpen(false)
    setValue('')
    requestAnimationFrame(() => btn.current?.focus())
  }
  async function submit(e: FormEvent) {
    e.preventDefault()
    const t = value.trim()
    if (!t) return
    setBusy(true)
    try {
      await onAdd(t)
      close()
    } catch (err) {
      toast(errorText(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button ref={btn} type="button" className="adm-add" onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" />
        {label}
      </button>
    )
  }
  return (
    <form className="adm-inline-form adm-inline-add" onSubmit={submit}>
      <label className="sr-only" htmlFor={inputId}>
        {inputLabel}
      </label>
      <input
        id={inputId}
        className="input"
        autoFocus
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            close()
          }
        }}
      />
      <div className="row" style={{ gap: 8 }}>
        <Button type="submit" size="sm" loading={busy} disabled={!value.trim()}>
          Ajouter
        </Button>
        <Button variant="ghost" size="sm" onClick={close} disabled={busy}>
          Annuler
        </Button>
      </div>
    </form>
  )
}
