// Éléments partagés par les pages de l'espace client.
import { useMemo } from 'react'
import { RotateCcw } from 'lucide-react'
import { resetDemo } from '../data/demo'
import { quote } from '../data/logic'
import type { Formation } from '../data/types'
import { useBackend, useClientData, useSession, type ClientData } from '../state'
import { Skeleton } from '../ui/kit'

/** Bandeau discret rappelant que l'on est dans l'espace de test */
export function DemoStrip() {
  const backend = useBackend()
  if (backend.mode !== 'demo') return null
  return (
    <div className="demo-strip" role="note">
      <span>
        <strong>Espace de test</strong> · données fictives, paiements simulés.
      </span>
      <button
        type="button"
        className="linkish small"
        onClick={() => {
          resetDemo()
          window.location.reload()
        }}
      >
        <RotateCcw size={14} aria-hidden="true" style={{ verticalAlign: -2, marginRight: 4 }} />
        Réinitialiser la démo
      </button>
    </div>
  )
}

/** Prix d'une formation pour le client connecté (meilleure réduction disponible). */
export function useQuote() {
  const { user } = useSession()
  const { data } = useClientData()
  return useMemo(() => {
    return (f: Pick<Formation, 'price'>, d: ClientData | null = data) =>
      quote(f, {
        rewards: d?.rewards ?? [],
        referredBy: user?.referredBy ?? null,
        // Une formation achetée = un accès d'origine « purchase »
        purchases: (d?.enrollments ?? []).filter((e) => e.source === 'purchase').map((e) => ({ id: e.formationId })),
        settings: d?.settings ?? { tiers: [], refereePercent: 0, rewardValidityDays: 90 },
      })
  }, [data, user?.referredBy])
}

export function PageSkeleton() {
  return (
    <div className="stack" aria-busy="true" aria-label="Chargement">
      <Skeleton h={14} w={120} />
      <Skeleton h={40} w="60%" />
      <Skeleton h={180} r={20} />
      <Skeleton h={90} r={20} />
    </div>
  )
}

export const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`
