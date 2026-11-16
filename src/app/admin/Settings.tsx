// Réglages du parrainage : paliers de récompense, avantage filleul, validité.
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Plus, Trash2 } from 'lucide-react'
import { useBackend } from '../state'
import { useToast } from '../ui/toast'
import { Button, Page, Skeleton } from '../ui/kit'
import { tierLabel } from '../data/logic'
import type { RewardKind, Settings } from '../data/types'
import { Field, errorText, useLoad } from './shared'

interface TierDraft {
  key: string
  threshold: string
  kind: RewardKind
  percent: string
}
interface Draft {
  tiers: TierDraft[]
  refereePercent: string
  rewardValidityDays: string
}
const key = () => Math.random().toString(36).slice(2, 9)
const toDraft = (s: Settings): Draft => ({
  tiers: [...s.tiers].sort((a, b) => a.threshold - b.threshold).map((t) => ({ key: key(), threshold: String(t.threshold), kind: t.kind, percent: String(t.percent) })),
  refereePercent: String(s.refereePercent),
  rewardValidityDays: String(s.rewardValidityDays),
})
const int = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s) : NaN)

export function SettingsPage() {
  const backend = useBackend()
  const toast = useToast()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [base, setBase] = useState<string>('')
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const { error, reload } = useLoad(async () => {
    const s = await backend.getSettings()
    const d = toDraft(s)
    setDraft(d)
    setBase(JSON.stringify(d))
    return s
  }, [backend])

  const dirty = !!draft && JSON.stringify(draft) !== base
  const setTier = (i: number, patch: Partial<TierDraft>) => setDraft((d) => (d ? { ...d, tiers: d.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) } : d))

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!draft) return
    const errs: string[] = []
    const tiers = draft.tiers.map((t) => ({ threshold: int(t.threshold), kind: t.kind, percent: t.kind === 'free' ? 100 : int(t.percent) }))
    tiers.forEach((t, i) => {
      if (!(t.threshold >= 1)) errs.push(`Palier ${i + 1} : le nombre de filleuls doit être un entier d’au moins 1.`)
      if (t.kind === 'percent' && !(t.percent >= 1 && t.percent <= 99)) errs.push(`Palier ${i + 1} : la réduction doit être comprise entre 1 et 99 %.`)
    })
    if (new Set(tiers.map((t) => t.threshold)).size !== tiers.length) errs.push('Deux paliers ne peuvent pas avoir le même nombre de filleuls.')
    const refereePercent = int(draft.refereePercent)
    const rewardValidityDays = int(draft.rewardValidityDays)
    if (!(refereePercent >= 0 && refereePercent <= 99)) errs.push('La réduction du filleul doit être comprise entre 0 et 99 %.')
    if (!(rewardValidityDays >= 1)) errs.push('La durée de validité doit être d’au moins 1 jour.')
    setErrors(errs)
    if (errs.length) {
      toast('Vérifiez les réglages signalés.', 'error')
      return
    }
    setSaving(true)
    try {
      const next: Settings = { tiers: [...tiers].sort((a, b) => a.threshold - b.threshold), refereePercent, rewardValidityDays }
      await backend.admin.saveSettings(next)
      const d = toDraft(next)
      setDraft(d)
      setBase(JSON.stringify(d))
      toast('Réglages enregistrés')
    } catch (x) {
      toast(errorText(x), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Page kicker="Parrainage" title="Réglages" sub="Récompenses accordées aux parrains selon le nombre de filleuls ayant acheté une formation, et avantage offert aux filleuls.">
      {error ? (
        <div className="panel soft row between wrap" role="alert">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={reload}>
            Réessayer
          </Button>
        </div>
      ) : !draft ? (
        <div className="stack" aria-busy="true" aria-label="Chargement des réglages">
          <Skeleton h={260} r={20} />
          <Skeleton h={160} r={20} />
        </div>
      ) : (
        <form className="stack-lg adm-form" onSubmit={save} noValidate>
          <section className="panel stack" aria-labelledby="s-tiers">
            <div>
              <h2 className="section-title" id="s-tiers" style={{ marginBottom: 4 }}>
                Paliers du parrain
              </h2>
              <p className="small muted" style={{ margin: 0 }}>
                Chaque palier franchi donne une récompense à usage unique sur la prochaine formation.
              </p>
            </div>
            {draft.tiers.length ? (
              <ol className="adm-tiers">
                {draft.tiers.map((t, i) => {
                  const n = int(t.threshold)
                  const p = int(t.percent)
                  return (
                    <li key={t.key} className="adm-tier">
                      <span className="adm-tier-num" aria-hidden="true">
                        {i + 1}
                      </span>
                      <div className="adm-tier-fields">
                        <Field id={`t-${t.key}-th`} label="Filleuls acheteurs">
                          <input id={`t-${t.key}-th`} className="input" type="number" min={1} step={1} inputMode="numeric" value={t.threshold} onChange={(e) => setTier(i, { threshold: e.target.value })} />
                        </Field>
                        <Field id={`t-${t.key}-kind`} label="Récompense">
                          <select
                            id={`t-${t.key}-kind`}
                            className="select"
                            value={t.kind}
                            onChange={(e) => {
                              const kind = e.target.value as RewardKind
                              setTier(i, { kind, percent: kind === 'free' ? '100' : t.percent === '100' ? '10' : t.percent })
                            }}
                          >
                            <option value="percent">Réduction en %</option>
                            <option value="free">Formation offerte</option>
                          </select>
                        </Field>
                        <Field id={`t-${t.key}-pc`} label="Réduction (%)">
                          <input
                            id={`t-${t.key}-pc`}
                            className="input"
                            type="number"
                            min={1}
                            max={99}
                            step={1}
                            inputMode="numeric"
                            value={t.kind === 'free' ? '100' : t.percent}
                            disabled={t.kind === 'free'}
                            onChange={(e) => setTier(i, { percent: e.target.value })}
                          />
                        </Field>
                      </div>
                      <p className="small muted adm-tier-sum">
                        {Number.isFinite(n) && n > 0 ? `${n} filleul${n > 1 ? 's' : ''} → ` : ''}
                        {t.kind === 'free' ? tierLabel({ kind: 'free', percent: 100 }) : Number.isFinite(p) ? tierLabel({ kind: 'percent', percent: p }) : '…'}
                      </p>
                      <button
                        type="button"
                        className="icon-btn adm-danger-icon adm-tier-del"
                        aria-label={`Retirer le palier ${i + 1}`}
                        onClick={() => setDraft((d) => (d ? { ...d, tiers: d.tiers.filter((_, j) => j !== i) } : d))}
                      >
                        <Trash2 />
                      </button>
                    </li>
                  )
                })}
              </ol>
            ) : (
              <p className="small muted" style={{ margin: 0 }}>
                Aucun palier : les parrains ne reçoivent pas de récompense.
              </p>
            )}
            <div>
              <button
                type="button"
                className="adm-add"
                onClick={() =>
                  setDraft((d) => {
                    if (!d) return d
                    const last = Math.max(0, ...d.tiers.map((t) => int(t.threshold) || 0))
                    return { ...d, tiers: [...d.tiers, { key: key(), threshold: String(last + 1), kind: 'percent', percent: '10' }] }
                  })
                }
              >
                <Plus aria-hidden="true" />
                Ajouter un palier
              </button>
            </div>
          </section>

          <section className="panel stack" aria-labelledby="s-other">
            <h2 className="section-title" id="s-other" style={{ margin: 0 }}>
              Filleul et validité
            </h2>
            <div className="adm-grid-2">
              <Field id="s-referee" label="Réduction du filleul (%)" hint="Sur sa première formation. Non cumulable avec une récompense.">
                <input
                  id="s-referee"
                  className="input"
                  type="number"
                  min={0}
                  max={99}
                  step={1}
                  inputMode="numeric"
                  value={draft.refereePercent}
                  onChange={(e) => setDraft({ ...draft, refereePercent: e.target.value })}
                  aria-describedby="s-referee-hint"
                />
              </Field>
              <Field id="s-validity" label="Validité d’une récompense (jours)" hint="À partir du jour où elle est obtenue.">
                <input
                  id="s-validity"
                  className="input"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={draft.rewardValidityDays}
                  onChange={(e) => setDraft({ ...draft, rewardValidityDays: e.target.value })}
                  aria-describedby="s-validity-hint"
                />
              </Field>
            </div>
          </section>

          <p className="small muted" style={{ margin: 0 }}>
            Les prix des formations se modifient dans la fiche de chaque formation, depuis la page <Link to="/admin/formations">Formations</Link>.
          </p>

          {errors.length ? (
            <ul className="adm-errors" role="alert">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}

          <div className="adm-savebar">
            <span className="small muted" aria-live="polite">
              {dirty ? 'Modifications non enregistrées' : 'Tout est enregistré'}
            </span>
            <Button type="submit" loading={saving} disabled={!dirty && !saving}>
              Enregistrer les réglages
            </Button>
          </div>
        </form>
      )}
    </Page>
  )
}
