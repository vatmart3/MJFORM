// Liste des formations du catalogue.
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { BookOpen, ChevronRight, Plus } from 'lucide-react'
import { useBackend } from '../state'
import { useToast } from '../ui/toast'
import { Button, EmptyState, Modal, Page, Skeleton, itemVariants, listVariants } from '../ui/kit'
import { formatEuro } from '../data/logic'
import type { Formation } from '../data/types'
import { Field, errorText, slugify, useLoad } from './shared'

export const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`

export function StatusBadge({ status }: { status: Formation['status'] }) {
  return status === 'published' ? <span className="badge blue">Publié</span> : <span className="badge">Brouillon</span>
}

export function FormationsList() {
  const { admin } = useBackend()
  const toast = useToast()
  const navigate = useNavigate()
  const { data, error, reload } = useLoad(() => admin.listFormations(), [admin])
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [titleErr, setTitleErr] = useState<string | null>(null)

  async function create(e: FormEvent) {
    e.preventDefault()
    const t = title.trim()
    if (!t) return setTitleErr('Indiquez un titre.')
    setBusy(true)
    try {
      const f = await admin.saveFormation({ title: t, slug: slugify(t), status: 'draft', position: data?.length ?? 0 })
      toast('Formation créée en brouillon')
      setCreating(false)
      navigate(`/admin/formations/${f.id}`)
    } catch (err) {
      toast(errorText(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  const openCreate = () => {
    setTitle('')
    setTitleErr(null)
    setCreating(true)
  }

  return (
    <Page
      kicker="Catalogue"
      title="Formations"
      sub="Fiches, programmes et leçons. Seules les formations publiées sont visibles dans l’espace client."
      actions={
        data && data.length ? (
          <Button onClick={openCreate}>
            <Plus aria-hidden="true" />
            Nouvelle formation
          </Button>
        ) : null
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
        <div className="adm-list" aria-busy="true" aria-label="Chargement des formations">
          {[0, 1, 2].map((i) => (
            <div key={i} className="adm-list-row" style={{ cursor: 'default' }}>
              <div className="stack" style={{ gap: 8 }}>
                <Skeleton h={20} w="60%" />
                <Skeleton h={14} w="40%" />
              </div>
            </div>
          ))}
        </div>
      ) : data.length === 0 ? (
        <EmptyState
          icon={<BookOpen />}
          title="Aucune formation pour l’instant"
          text="Créez votre première formation : sa fiche, puis ses modules et ses leçons. Elle reste en brouillon tant que vous ne la publiez pas."
          action={
            <Button onClick={openCreate}>
              <Plus aria-hidden="true" />
              Nouvelle formation
            </Button>
          }
        />
      ) : (
        <motion.ul className="adm-list" variants={listVariants} initial="hidden" animate="show">
          <li className="adm-list-head" aria-hidden="true">
            <span>Formation</span>
            <span>Niveau</span>
            <span>Contenu</span>
            <span>Statut</span>
            <span className="num">Prix</span>
          </li>
          {data.map((f) => {
            const lessons = f.modules.reduce((n, m) => n + m.lessons.length, 0)
            return (
              <motion.li key={f.id} variants={itemVariants}>
                <Link to={`/admin/formations/${f.id}`} className="adm-list-row adm-formation-row">
                  <span className="adm-ftitle">
                    <strong>{f.title}</strong>
                    {f.subtitle ? <span className="muted small">{f.subtitle}</span> : null}
                  </span>
                  <span className="small">{f.level}</span>
                  <span className="small muted">
                    {plural(f.modules.length, 'module', 'modules')} · {plural(lessons, 'leçon', 'leçons')}
                  </span>
                  <span>
                    <StatusBadge status={f.status} />
                  </span>
                  <span className="num adm-price">{formatEuro(f.price)}</span>
                  <ChevronRight className="adm-chev" aria-hidden="true" />
                </Link>
              </motion.li>
            )
          })}
        </motion.ul>
      )}

      <Modal open={creating} onClose={() => !busy && setCreating(false)} title="Nouvelle formation" labelledBy="new-formation-title">
        <form className="stack" onSubmit={create} noValidate>
          <p className="muted small" style={{ margin: 0 }}>
            Elle est créée en brouillon : vous compléterez sa fiche et son programme ensuite.
          </p>
          <Field id="nf-title" label="Titre" error={titleErr}>
            <input
              id="nf-title"
              className="input"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                setTitleErr(null)
              }}
              aria-invalid={titleErr ? true : undefined}
              aria-describedby={titleErr ? 'nf-title-err' : undefined}
              placeholder="Ex. ChatGPT pour votre commerce"
            />
          </Field>
          <div className="row wrap adm-modal-actions">
            <Button variant="ghost" onClick={() => setCreating(false)} disabled={busy}>
              Annuler
            </Button>
            <Button type="submit" loading={busy}>
              Créer la formation
            </Button>
          </div>
        </form>
      </Modal>
    </Page>
  )
}
