// Retour de paiement : confirmation et accès direct à la formation débloquée.
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { motion } from 'motion/react'
import { resumeLesson } from '../data/logic'
import { useClientData } from '../state'
import { CheckDraw, enter } from '../ui/kit'

export function Merci() {
  const [params] = useSearchParams()
  const slug = params.get('formation')
  const { data, refresh } = useClientData()
  const [tries, setTries] = useState(0)

  const f = data?.formations.find((x) => x.slug === slug)
  const owned = f && data?.enrollments.some((e) => e.formationId === f.id)

  // En production, l'accès est donné par le webhook Stripe : on vérifie quelques secondes.
  useEffect(() => {
    if (owned || tries > 6) return
    const t = setTimeout(() => {
      refresh().finally(() => setTries((n) => n + 1))
    }, 1500)
    return () => clearTimeout(t)
  }, [owned, tries, refresh])

  const first = f && data ? resumeLesson(f, data.progress) : null

  return (
    <motion.div className="merci" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={enter}>
      <CheckDraw done={Boolean(owned)} size={56} />
      <h1 className="page-title" style={{ marginTop: 20 }}>
        {owned ? 'C’est débloqué.' : 'Paiement reçu.'}
      </h1>
      <p className="page-sub">
        {owned
          ? `${f!.title} vous attend. Votre facture arrive par e-mail.`
          : tries > 6
            ? 'L’accès prend un peu plus de temps que prévu. Rechargez la page dans une minute, ou écrivez-nous.'
            : 'Nous ouvrons votre accès…'}
      </p>
      {owned && f ? (
        <Link className="btn btn-primary" style={{ marginTop: 28 }} to={`/espace/formations/${f.slug}/${first?.id ?? ''}`}>
          Commencer la formation
        </Link>
      ) : null}
    </motion.div>
  )
}
