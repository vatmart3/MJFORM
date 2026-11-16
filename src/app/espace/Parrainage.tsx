// Parrainage : lien et code uniques, partage, jauge vers le palier suivant, récompenses et filleuls.
import { motion } from 'motion/react'
import { Check, Copy, Gift, Mail, MessageCircle, MessageSquareText, Users } from 'lucide-react'
import { activeRewards, daysLeft, formatDate, referralProgress, tierLabel } from '../data/logic'
import type { ReferralStatus } from '../data/types'
import { useClientData, useSession } from '../state'
import { EmptyState, Page, itemVariants, listVariants } from '../ui/kit'
import { useToast } from '../ui/toast'
import { PageSkeleton, plural } from './common'

const STEPS: { key: ReferralStatus; label: string }[] = [
  { key: 'invited', label: 'Invité' },
  { key: 'signed_up', label: 'Inscrit' },
  { key: 'purchased', label: 'A acheté' },
]

export function Parrainage() {
  const { user } = useSession()
  const { data } = useClientData()
  const toast = useToast()
  if (!data || !user) return <PageSkeleton />

  const link = `${window.location.origin}/espace/inscription?ref=${user.referralCode}`
  const purchased = data.referrals.filter((r) => r.status === 'purchased').length
  const prog = referralProgress(purchased, data.settings.tiers)
  const tiers = [...data.settings.tiers].sort((a, b) => a.threshold - b.threshold)
  const max = tiers[tiers.length - 1]?.threshold ?? 1
  const rewards = [...data.rewards].sort((a, b) => b.expiresAt.localeCompare(a.expiresAt))
  const active = new Set(activeRewards(data.rewards).map((r) => r.id))
  const message = `Je me forme à l’IA pour mon commerce avec MJ FORM, à Sète. Avec mon lien, vous avez -${data.settings.refereePercent} % sur votre première formation : ${link}`

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast(`${what} copié`)
    } catch {
      toast('Copie impossible : sélectionnez le texte à la main.', 'error')
    }
  }

  return (
    <Page kicker="Parrainage" title="Partagez. Gagnez." sub={`Chaque commerçant que vous invitez a -${data.settings.refereePercent} % sur sa première formation. Vous, vous débloquez des réductions à chaque palier.`}>
      <motion.div className="stack-lg" variants={listVariants} initial="hidden" animate="show">
        <motion.section variants={itemVariants} className="ref-share" aria-labelledby="share-title">
          <h2 id="share-title" className="section-title">
            Votre lien
          </h2>
          <div className="ref-link">
            <input className="input" readOnly value={link} aria-label="Votre lien de parrainage" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="btn btn-primary" onClick={() => copy(link, 'Lien')}>
              <Copy aria-hidden="true" /> Copier
            </button>
          </div>
          <p className="small muted" style={{ margin: '10px 0 0' }}>
            Votre code :{' '}
            <button type="button" className="linkish" onClick={() => copy(user.referralCode, 'Code')} aria-label={`Copier le code ${user.referralCode}`}>
              <strong style={{ letterSpacing: '0.04em' }}>{user.referralCode}</strong>
            </button>
          </p>
          <div className="share-row">
            <a className="btn btn-ghost btn-sm" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener">
              <MessageCircle aria-hidden="true" /> WhatsApp
            </a>
            <a className="btn btn-ghost btn-sm" href={`sms:?&body=${encodeURIComponent(message)}`}>
              <MessageSquareText aria-hidden="true" /> SMS
            </a>
            <a className="btn btn-ghost btn-sm" href={`mailto:?subject=${encodeURIComponent('Une formation IA pour votre commerce')}&body=${encodeURIComponent(message)}`}>
              <Mail aria-hidden="true" /> E-mail
            </a>
          </div>
        </motion.section>

        <motion.section variants={itemVariants} className="panel" aria-labelledby="tiers-title">
          <div className="row between wrap" style={{ alignItems: 'baseline' }}>
            <h2 id="tiers-title" className="section-title" style={{ margin: 0 }}>
              {prog.next ? (
                <>
                  Plus {prog.remaining === 1 ? 'qu’' : 'que '}
                  {plural(prog.remaining, 'filleul', 'filleuls')} pour {tierLabel(prog.next)}
                </>
              ) : (
                'Tous les paliers sont atteints'
              )}
            </h2>
            <span className="small muted">{plural(purchased, 'filleul a acheté', 'filleuls ont acheté')}</span>
          </div>
          <div className="gauge" role="progressbar" aria-label="Progression vers le palier suivant" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(purchased, max)}>
            <motion.span className="gauge-fill" initial={{ scaleX: 0 }} animate={{ scaleX: Math.min(1, purchased / max) }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} />
            {tiers.map((t) => (
              <span key={t.threshold} className={`gauge-mark${purchased >= t.threshold ? ' on' : ''}`} style={{ left: `${(t.threshold / max) * 100}%` }} />
            ))}
          </div>
          <ol className="tiers">
            {tiers.map((t) => (
              <li key={t.threshold} className={purchased >= t.threshold ? 'on' : ''}>
                <span className="tier-n">{plural(t.threshold, 'filleul', 'filleuls')}</span>
                <strong>{tierLabel(t)}</strong>
                <span className="tiny muted">{t.kind === 'free' ? 'sur la formation de votre choix' : 'sur votre prochaine formation'}</span>
              </li>
            ))}
          </ol>
        </motion.section>

        <motion.section variants={itemVariants} aria-labelledby="rewards-title">
          <h2 id="rewards-title" className="section-title">
            Vos récompenses
          </h2>
          {rewards.length === 0 ? (
            <EmptyState icon={<Gift />} title="Pas encore de récompense" text="Dès que votre premier filleul achète une formation, vous recevez -10 % sur la prochaine." />
          ) : (
            <ul className="rewards">
              {rewards.map((r) => {
                const isActive = active.has(r.id)
                return (
                  <li key={r.id} className={isActive ? '' : 'off'}>
                    <span className="reward-value">{r.kind === 'free' ? 'Offerte' : `-${r.percent} %`}</span>
                    <span>
                      <strong>{r.label}</strong>
                      <span className="tiny muted" style={{ display: 'block' }}>
                        {r.usedAt
                          ? `Utilisée le ${formatDate(r.usedAt)}`
                          : isActive
                            ? `Expire dans ${plural(daysLeft(r.expiresAt), 'jour', 'jours')} (${formatDate(r.expiresAt)})`
                            : `Expirée le ${formatDate(r.expiresAt)}`}
                      </span>
                    </span>
                    {isActive ? <span className="badge blue">Disponible</span> : null}
                  </li>
                )
              })}
            </ul>
          )}
        </motion.section>

        <motion.section variants={itemVariants} aria-labelledby="refs-title">
          <h2 id="refs-title" className="section-title">
            Vos filleuls
          </h2>
          {data.referrals.length === 0 ? (
            <EmptyState icon={<Users />} title="Aucun filleul pour l’instant" text="Partagez votre lien à un commerçant que vous connaissez : il le reçoit en un message." />
          ) : (
            <ul className="refs">
              {data.referrals.map((r) => {
                const idx = STEPS.findIndex((s) => s.key === r.status)
                return (
                  <li key={r.id}>
                    <div>
                      <strong>{r.label}</strong>
                      <span className="tiny muted" style={{ display: 'block' }}>
                        Depuis le {formatDate(r.createdAt, { day: 'numeric', month: 'long' })}
                      </span>
                    </div>
                    <ol className="steps3" aria-label={`Statut : ${STEPS[idx].label}`}>
                      {STEPS.map((s, i) => (
                        <li key={s.key} className={i <= idx ? 'on' : ''}>
                          <span className="dot3">{i <= idx ? <Check aria-hidden="true" /> : null}</span>
                          <span className="tiny">{s.label}</span>
                        </li>
                      ))}
                    </ol>
                  </li>
                )
              })}
            </ul>
          )}
        </motion.section>
      </motion.div>
    </Page>
  )
}
