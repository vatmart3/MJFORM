// Import CSV des participants d'un atelier : aperçu, validation ligne à ligne, invitation.
import { useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { AlertCircle, CheckCircle2, Download, FileUp, Mail, RotateCcw } from 'lucide-react'
import { useBackend } from '../state'
import { useToast } from '../ui/toast'
import { Button, Page, Skeleton, enter } from '../ui/kit'
import { formatDate } from '../data/logic'
import type { ImportResult } from '../data/types'
import { Field, errorText, useLoad } from './shared'
import { parseParticipants } from './csv'

const TEMPLATE = 'prénom;nom;email;téléphone\nCamille;Durand;camille@exemple.fr;06 12 34 56 78\n'
const SEP_LABEL: Record<string, string> = { ',': 'virgule', ';': 'point-virgule', '\t': 'tabulation' }

export function ImportParticipants() {
  const backend = useBackend()
  const { admin } = backend
  const toast = useToast()
  const { data: refs, error } = useLoad(async () => {
    const [formations, workshops] = await Promise.all([admin.listFormations(), admin.listWorkshops()])
    return { formations, workshops }
  }, [admin])

  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [formationId, setFormationId] = useState('')
  const [workshopId, setWorkshopId] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const parsed = useMemo(() => (text.trim() ? parseParticipants(text) : null), [text])
  const valid = parsed?.rows.filter((r) => !r.errors.length) ?? []
  const invalid = (parsed?.rows.length ?? 0) - valid.length
  const formation = formationId || refs?.formations[0]?.id || ''

  async function submit() {
    if (!valid.length || !formation) return
    setBusy(true)
    try {
      const res = await admin.importParticipants(
        valid.map(({ firstName, lastName, email, phone }) => ({ firstName, lastName, email, phone })),
        formation,
        workshopId || null,
      )
      setResult(res)
      toast(`${res.invited + res.alreadyMember} participant${res.invited + res.alreadyMember > 1 ? 's' : ''} importé${res.invited + res.alreadyMember > 1 ? 's' : ''}`)
    } catch (e) {
      toast(errorText(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setText('')
    setFileName(null)
    setResult(null)
  }

  const demo = backend.mode === 'demo'
  const magic = demo
    ? 'Chaque participant reçoit un lien magique d’activation par e-mail. En mode démo, l’envoi est simulé : aucun e-mail ne part, la personne peut se connecter depuis /espace avec son adresse.'
    : 'Chaque participant reçoit un lien magique d’activation par e-mail : un clic suffit pour accéder à sa formation, sans mot de passe.'

  if (result) {
    return (
      <Page kicker="Après un atelier" title="Import terminé">
        <motion.div className="stack-lg" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={enter}>
          <dl className="adm-stats">
            <div>
              <dt>Invités</dt>
              <dd>{result.invited}</dd>
              <span className="small muted">nouveaux comptes, lien d’activation envoyé{demo ? ' (simulé)' : ''}</span>
            </div>
            <div>
              <dt>Déjà membres</dt>
              <dd>{result.alreadyMember}</dd>
              <span className="small muted">accès ajouté à leur compte existant</span>
            </div>
            <div>
              <dt>Erreurs</dt>
              <dd className={result.errors.length ? 'adm-danger-text' : undefined}>{result.errors.length}</dd>
              <span className="small muted">{result.errors.length ? 'lignes non importées' : 'aucune ligne rejetée'}</span>
            </div>
          </dl>
          {result.errors.length ? (
            <div className="panel stack" role="alert">
              <h2 className="section-title" style={{ margin: 0 }}>
                Lignes non importées
              </h2>
              <ul className="adm-errors">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    <AlertCircle aria-hidden="true" />
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="muted small" style={{ margin: 0 }}>
            <Mail aria-hidden="true" className="adm-inline-icon" /> {magic}
          </p>
          <div>
            <Button variant="ghost" onClick={reset}>
              <RotateCcw aria-hidden="true" />
              Nouvel import
            </Button>
          </div>
        </motion.div>
      </Page>
    )
  }

  return (
    <Page kicker="Après un atelier" title="Importer des participants" sub="Donnez en une fois l’accès à la formation aux participants d’un atelier, à partir d’un fichier CSV ou d’un copier-coller depuis votre tableur.">
      <div className="stack-lg">
        <section className="panel stack" aria-labelledby="imp-1">
          <h2 className="section-title adm-step" id="imp-1">
            <span aria-hidden="true">1</span>
            Liste des participants
          </h2>
          <div className="row wrap" style={{ gap: 8 }}>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              hidden
              tabIndex={-1}
              aria-hidden="true"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                try {
                  setText(await f.text())
                  setFileName(f.name)
                } catch {
                  toast('Impossible de lire ce fichier.', 'error')
                }
              }}
            />
            <Button variant="ghost" size="sm" onClick={() => fileInput.current?.click()}>
              <FileUp aria-hidden="true" />
              Choisir un fichier CSV
            </Button>
            <a className="btn btn-quiet btn-sm" href={`data:text/csv;charset=utf-8,${encodeURIComponent('﻿' + TEMPLATE)}`} download="participants-modele.csv">
              <Download aria-hidden="true" />
              Modèle
            </a>
            {fileName ? <span className="small muted">Fichier : {fileName}</span> : null}
          </div>
          <Field id="imp-text" label="Ou collez le contenu ici" hint="Première ligne : les en-têtes (prénom, nom, email, téléphone). Séparateur virgule, point-virgule ou tabulation.">
            <textarea
              id="imp-text"
              className="textarea adm-mono"
              rows={7}
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setFileName(null)
              }}
              placeholder={TEMPLATE}
              aria-describedby="imp-text-hint"
              spellCheck={false}
            />
          </Field>
        </section>

        {parsed ? (
          <section className="stack" aria-labelledby="imp-2">
            <h2 className="section-title adm-step" id="imp-2">
              <span aria-hidden="true">2</span>
              Vérification
            </h2>
            {parsed.fatal ? (
              <p className="panel soft adm-alert" role="alert">
                <AlertCircle aria-hidden="true" />
                {parsed.fatal}
              </p>
            ) : (
              <>
                <p className="small" style={{ margin: 0 }} aria-live="polite">
                  <strong>{parsed.rows.length}</strong> ligne{parsed.rows.length > 1 ? 's' : ''} · <strong>{valid.length}</strong> valide{valid.length > 1 ? 's' : ''}
                  {invalid ? (
                    <>
                      {' '}
                      · <strong className="adm-danger-text">{invalid}</strong> à corriger (ignorée{invalid > 1 ? 's' : ''})
                    </>
                  ) : null}
                  <span className="muted"> · séparateur : {SEP_LABEL[parsed.separator]}</span>
                </p>
                {parsed.rows.length ? (
                  <div className="table-wrap">
                    <table className="table adm-preview-table">
                      <caption className="sr-only">Aperçu des participants à importer</caption>
                      <thead>
                        <tr>
                          <th scope="col">Ligne</th>
                          <th scope="col">Prénom</th>
                          <th scope="col">Nom</th>
                          <th scope="col">E-mail</th>
                          <th scope="col">Téléphone</th>
                          <th scope="col">État</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.rows.map((r) => (
                          <tr key={r.line} className={r.errors.length ? 'is-invalid' : undefined}>
                            <td className="muted">{r.line}</td>
                            <td>{r.firstName || <span className="muted">—</span>}</td>
                            <td>{r.lastName || <span className="muted">—</span>}</td>
                            <td>{r.email || <span className="muted">—</span>}</td>
                            <td className="adm-nowrap">{r.phone || <span className="muted">—</span>}</td>
                            <td>
                              {r.errors.length ? (
                                <span className="adm-state bad">
                                  <AlertCircle aria-hidden="true" />
                                  {r.errors.join(', ')}
                                </span>
                              ) : (
                                <span className="adm-state ok">
                                  <CheckCircle2 aria-hidden="true" />
                                  {r.warnings.length ? r.warnings.join(', ') : 'Prêt'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="small muted" style={{ margin: 0 }}>
                    Seule la ligne d’en-tête a été trouvée : ajoutez au moins un participant.
                  </p>
                )}
              </>
            )}
          </section>
        ) : null}

        <section className="panel stack" aria-labelledby="imp-3">
          <h2 className="section-title adm-step" id="imp-3">
            <span aria-hidden="true">3</span>
            Accès à donner
          </h2>
          {error ? (
            <p className="adm-danger-text small" role="alert">
              {error}
            </p>
          ) : !refs ? (
            <div className="adm-grid-2" aria-busy="true">
              <Skeleton h={72} />
              <Skeleton h={72} />
            </div>
          ) : (
            <div className="adm-grid-2">
              <Field id="imp-formation" label="Formation">
                <select id="imp-formation" className="select" value={formation} onChange={(e) => setFormationId(e.target.value)}>
                  {refs.formations.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.title}
                      {f.status === 'draft' ? ' (brouillon)' : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="imp-workshop" label="Atelier (facultatif)" hint="Les participants sont ajoutés à la liste des inscrits.">
                <select id="imp-workshop" className="select" value={workshopId} onChange={(e) => setWorkshopId(e.target.value)} aria-describedby="imp-workshop-hint">
                  <option value="">Aucun atelier</option>
                  {refs.workshops.map((w) => (
                    <option key={w.id} value={w.id}>
                      {formatDate(w.startsAt, { day: 'numeric', month: 'short', year: 'numeric' })} · {w.title}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}
          <p className="small adm-note">
            <Mail aria-hidden="true" />
            <span>{magic}</span>
          </p>
          <div className="adm-savebar" style={{ marginTop: 4 }}>
            <span className="small muted">{valid.length ? `${valid.length} participant${valid.length > 1 ? 's' : ''} prêt${valid.length > 1 ? 's' : ''}` : 'Ajoutez des participants à l’étape 1'}</span>
            <Button onClick={submit} loading={busy} disabled={!valid.length || !formation || !!parsed?.fatal}>
              Importer {valid.length ? `${valid.length} participant${valid.length > 1 ? 's' : ''}` : ''}
            </Button>
          </div>
        </section>
      </div>
    </Page>
  )
}
