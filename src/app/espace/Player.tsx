// Lecteur de formation façon Skool : plan du cours à gauche (modules → leçons, coches),
// leçon au centre (vidéo avec reprise, diaporama PDF, texte, ressources), validation animée.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { AlignLeft, ArrowLeft, ArrowRight, ChevronDown, Download, FileText, ListTree, PlayCircle } from 'lucide-react'
import { AccessError } from '../data/backend'
import { allLessons, formationProgress } from '../data/logic'
import type { LessonContent, LessonKind } from '../data/types'
import { useBackend, useClientData } from '../state'
import { Button, CheckDraw, Counter, ProgressBar, Skeleton, enter } from '../ui/kit'
import { Markdown } from '../ui/markdown'
import { useToast } from '../ui/toast'
import { PageSkeleton } from './common'
import { Slides } from './Slides'

const KIND: Record<LessonKind, { icon: typeof FileText; label: string }> = {
  video: { icon: PlayCircle, label: 'Vidéo' },
  slides: { icon: FileText, label: 'Diaporama' },
  text: { icon: AlignLeft, label: 'Lecture' },
}

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/** Vidéo avec reprise automatique à la dernière position */
function Video({ lesson, start, onSave }: { lesson: LessonContent; start: number; onSave: (s: number) => void }) {
  const ref = useRef<HTMLVideoElement>(null)
  const last = useRef(0)
  const [resumed, setResumed] = useState<number | null>(null)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    const onMeta = () => {
      if (start > 5 && start < v.duration - 5) {
        v.currentTime = start
        setResumed(start)
      }
    }
    const save = () => {
      if (Math.abs(v.currentTime - last.current) >= 5 || v.paused) {
        last.current = v.currentTime
        onSave(v.currentTime)
      }
    }
    v.addEventListener('loadedmetadata', onMeta)
    v.addEventListener('timeupdate', save)
    v.addEventListener('pause', save)
    return () => {
      v.removeEventListener('loadedmetadata', onMeta)
      v.removeEventListener('timeupdate', save)
      v.removeEventListener('pause', save)
      if (v.currentTime > 0) onSave(v.currentTime)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id])
  return (
    <div className="video">
      <video ref={ref} src={lesson.videoUrl ?? undefined} controls playsInline preload="metadata" aria-label={lesson.title} controlsList={lesson.allowDownload ? undefined : 'nodownload'} />
      {resumed ? (
        <span className="badge" style={{ marginTop: 10 }}>
          Reprise à {fmtTime(resumed)}
        </span>
      ) : null}
    </div>
  )
}

export default function Player() {
  const { slug, lessonId } = useParams()
  const backend = useBackend()
  const { data, patch } = useClientData()
  const navigate = useNavigate()
  const toast = useToast()
  const [lesson, setLesson] = useState<LessonContent | null>(null)
  const [locked, setLocked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [outlineOpen, setOutlineOpen] = useState(false)

  const formation = data?.formations.find((f) => f.slug === slug)
  const lessons = useMemo(() => (formation ? allLessons(formation) : []), [formation])
  const current = lessons.find((l) => l.id === lessonId) ?? lessons[0]

  useEffect(() => {
    if (!current) return
    let alive = true
    setLesson(null)
    setOutlineOpen(false)
    backend
      .getLesson(current.id)
      .then((l) => alive && setLesson(l))
      .catch((e) => {
        if (alive && e instanceof AccessError) setLocked(true)
      })
    return () => {
      alive = false
    }
  }, [backend, current?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return <PageSkeleton />
  if (!formation || !current) return <Navigate to="/espace/formations" replace />
  if (locked || !data.enrollments.some((e) => e.formationId === formation.id)) return <Navigate to={`/espace/catalogue#${formation.slug}`} replace />

  const done = new Set(data.progress.filter((p) => p.completedAt).map((p) => p.lessonId))
  const prog = formationProgress(formation, data.progress)
  const idx = lessons.findIndex((l) => l.id === current.id)
  const prev = lessons[idx - 1]
  const next = lessons[idx + 1]
  const isDone = done.has(current.id)
  const startAt = data.progress.find((p) => p.lessonId === current.id)?.videoPosition ?? 0
  const module = formation.modules.find((m) => m.id === current.moduleId)

  const toggleDone = async () => {
    const value = !isDone
    setSaving(true)
    // Optimiste : la coche se dessine et la barre avance tout de suite
    patch((d) => {
      const others = d.progress.filter((p) => p.lessonId !== current.id)
      const existing = d.progress.find((p) => p.lessonId === current.id)
      return { ...d, progress: [...others, { lessonId: current.id, videoPosition: existing?.videoPosition ?? 0, completedAt: value ? new Date().toISOString() : null }] }
    })
    try {
      await backend.setLessonCompleted(current.id, value)
      if (value) toast(next ? 'Leçon terminée. Passons à la suite.' : 'Formation terminée. Bravo !')
    } catch {
      toast('Enregistrement impossible. Réessayez.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const outline = (
    <nav className="outline" aria-label="Plan du cours">
      <div className="outline-head">
        <Link to="/espace/formations" className="small row" style={{ gap: 4, color: 'var(--ink-2)' }}>
          <ArrowLeft size={14} aria-hidden="true" /> Mes formations
        </Link>
        <h2 className="outline-title">{formation.title}</h2>
        <div className="row" style={{ gap: 10 }}>
          <div style={{ flex: 1 }}>
            <ProgressBar value={prog.ratio} label={`${prog.completed} leçons terminées sur ${prog.total}`} />
          </div>
          <span className="small" style={{ fontVariantNumeric: 'tabular-nums' }}>
            <Counter value={prog.completed} />/{prog.total}
          </span>
        </div>
      </div>
      <ol className="outline-modules">
        {[...formation.modules]
          .sort((a, b) => a.position - b.position)
          .map((m) => (
            <li key={m.id}>
              <p className="outline-module">{m.title}</p>
              <ol>
                {m.lessons
                  .filter((l) => l.status === 'published')
                  .sort((a, b) => a.position - b.position)
                  .map((l) => {
                    const Icon = KIND[l.kind].icon
                    return (
                      <li key={l.id}>
                        <Link to={`/espace/formations/${formation.slug}/${l.id}`} className="outline-lesson" aria-current={l.id === current.id ? 'page' : undefined}>
                          <CheckDraw done={done.has(l.id)} size={20} />
                          <span className="outline-lesson-title">{l.title}</span>
                          <span className="outline-lesson-meta">
                            <Icon aria-label={KIND[l.kind].label} />
                            {l.durationMin >= 60 ? `${Math.round(l.durationMin / 60)} h` : `${l.durationMin} min`}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
              </ol>
            </li>
          ))}
      </ol>
    </nav>
  )

  return (
    <div className="player">
      <aside className="player-side">{outline}</aside>

      <div className="player-main">
        <button type="button" className="outline-toggle" aria-expanded={outlineOpen} onClick={() => setOutlineOpen((v) => !v)}>
          <ListTree aria-hidden="true" />
          <span>
            Plan du cours · {prog.completed}/{prog.total}
          </span>
          <ChevronDown aria-hidden="true" style={{ marginLeft: 'auto', transform: outlineOpen ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
        </button>
        <AnimatePresence initial={false}>
          {outlineOpen ? (
            <motion.div className="outline-drawer" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
              {outline}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.article key={current.id} className="lesson" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={enter}>
          <p className="kicker small muted" style={{ margin: '0 0 6px' }}>
            {module?.title} · {KIND[current.kind].label}
          </p>
          <h1 className="page-title lesson-title">{current.title}</h1>

          {!lesson ? (
            <div className="stack" style={{ marginTop: 24 }}>
              <Skeleton h={current.kind === 'text' ? 18 : 300} r={16} />
              <Skeleton h={18} w="80%" />
            </div>
          ) : (
            <div className="lesson-body">
              {lesson.kind === 'video' && lesson.videoUrl ? <Video lesson={lesson} start={startAt} onSave={(s) => backend.saveVideoPosition(lesson.id, s)} /> : null}
              {lesson.kind === 'slides' && lesson.slidesUrl ? <Slides url={lesson.slidesUrl} allowDownload={lesson.allowDownload} title={lesson.title} /> : null}
              {lesson.body ? <Markdown source={lesson.body} /> : null}
              {lesson.resources.length ? (
                <section aria-labelledby="res-title">
                  <h2 id="res-title" className="section-title" style={{ fontSize: 17 }}>
                    Ressources
                  </h2>
                  <ul className="resources">
                    {lesson.resources.map((r) => (
                      <li key={r.id}>
                        <a href={r.url} download target="_blank" rel="noopener">
                          <Download aria-hidden="true" />
                          <span>{r.name}</span>
                          {r.size ? <span className="tiny muted">{r.size}</span> : null}
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          )}

          <div className="lesson-foot">
            <Button variant={isDone ? 'ghost' : 'primary'} onClick={toggleDone} loading={saving} aria-pressed={isDone}>
              {!saving ? <CheckDraw done={isDone} size={20} /> : null}
              {isDone ? 'Terminée' : 'Marquer comme terminé'}
            </Button>
            <div className="row" style={{ gap: 8 }}>
              <Button variant="ghost" size="sm" disabled={!prev} onClick={() => prev && navigate(`/espace/formations/${formation.slug}/${prev.id}`)} aria-label="Leçon précédente">
                <ArrowLeft aria-hidden="true" /> Précédente
              </Button>
              <Button variant="ghost" size="sm" disabled={!next} onClick={() => next && navigate(`/espace/formations/${formation.slug}/${next.id}`)} aria-label="Leçon suivante">
                Suivante <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </div>
        </motion.article>
      </div>
    </div>
  )
}
