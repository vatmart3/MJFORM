// Espace client : routes et navigation.
import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { BookOpen, Gift, House, LayoutGrid, UserRound } from 'lucide-react'
import { Shell, type NavItem } from '../Shell'
import './espace.css'
import { ClientDataProvider, useSession } from '../state'
import { Skeleton } from '../ui/kit'
import { Dashboard } from './Dashboard'
import { MyFormations } from './MyFormations'
import { Catalogue } from './Catalogue'
import { Parrainage } from './Parrainage'
import { Profil } from './Profil'
import { Merci } from './Merci'
import { DemoStrip } from './common'
import { NavLink } from 'react-router'
import { ShieldCheck } from 'lucide-react'

// Le lecteur (vidéo, PDF) est chargé à la demande
const Player = lazy(() => import('./Player'))

const ITEMS: NavItem[] = [
  { to: '/espace', label: 'Tableau de bord', short: 'Accueil', icon: House, end: true },
  { to: '/espace/formations', label: 'Mes formations', short: 'Formations', icon: BookOpen },
  { to: '/espace/catalogue', label: 'À débloquer', short: 'Débloquer', icon: LayoutGrid },
  { to: '/espace/parrainage', label: 'Parrainage', icon: Gift },
  { to: '/espace/profil', label: 'Profil', icon: UserRound },
]

export default function EspaceApp() {
  const { user } = useSession()
  return (
    <ClientDataProvider>
      <Shell
        items={ITEMS}
        footer={
          user?.role === 'admin' ? (
            <NavLink to="/admin" className="side-link">
              <ShieldCheck aria-hidden="true" />
              <span className="label">Administration</span>
            </NavLink>
          ) : null
        }
      >
        <DemoStrip />
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="formations" element={<MyFormations />} />
          <Route
            path="formations/:slug/:lessonId?"
            element={
              <Suspense fallback={<Skeleton h={320} r={20} />}>
                <Player />
              </Suspense>
            }
          />
          <Route path="catalogue" element={<Catalogue />} />
          <Route path="parrainage" element={<Parrainage />} />
          <Route path="profil" element={<Profil />} />
          <Route path="merci" element={<Merci />} />
          <Route path="inscription" element={<Navigate to="/espace" replace />} />
          <Route path="*" element={<Navigate to="/espace" replace />} />
        </Routes>
      </Shell>
    </ClientDataProvider>
  )
}
