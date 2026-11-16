// Mes formations : les formations débloquées, les commencées d'abord.
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { BookOpen } from 'lucide-react'
import { formationProgress, resumeLesson, sortForResume } from '../data/logic'
import { useClientData } from '../state'
import { EmptyState, Page, ProgressBar, ProgressRing, itemVariants, listVariants } from '../ui/kit'
import { PageSkeleton } from './common'

export function MyFormations() {
  const { data } = useClientData()
  if (!data) return <PageSkeleton />
  const owned = sortForResume(data.formations, data.enrollments, data.progress)

  return (
    <Page kicker="Mes formations" title="Vos formations." sub="Les formations commencées passent en premier : reprenez là où vous vous êtes arrêté.">
      {owned.length === 0 ? (
        <EmptyState
          icon={<BookOpen />}
          title="Aucune formation pour l’instant"
          text="Découvrez l’atelier d’initiation : la meilleure porte d’entrée pour utiliser l’IA dans votre commerce."
          action={
            <Link className="btn btn-primary" to="/espace/catalogue">
              Découvrir l’atelier d’initiation
            </Link>
          }
        />
      ) : (
        <motion.ul className="flist" variants={listVariants} initial="hidden" animate="show">
          {owned.map((f) => {
            const p = formationProgress(f, data.progress)
            const next = resumeLesson(f, data.progress)
            const state = p.completed === 0 ? 'Commencer' : p.completed < p.total ? 'Reprendre' : 'Revoir'
            return (
              <motion.li key={f.id} variants={itemVariants}>
                <Link className="frow" to={`/espace/formations/${f.slug}/${next?.id ?? ''}`}>
                  <ProgressRing value={p.ratio} size={52} stroke={5} label={`${Math.round(p.ratio * 100)} % terminé`}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{Math.round(p.ratio * 100)}%</span>
                  </ProgressRing>
                  <div className="frow-body">
                    <span className="frow-meta">
                      {f.level} · {f.duration}
                    </span>
                    <strong className="frow-title">{f.title}</strong>
                    <div className="frow-bar">
                      <ProgressBar value={p.ratio} label={`${f.title} : ${p.completed} leçons sur ${p.total}`} />
                      <span className="tiny muted">
                        {p.completed}/{p.total}
                      </span>
                    </div>
                  </div>
                  <span className="link-arrow small frow-cta">{state}</span>
                </Link>
              </motion.li>
            )
          })}
        </motion.ul>
      )}
    </Page>
  )
}
