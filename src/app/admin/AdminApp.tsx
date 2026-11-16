// Back-office MJ FORM : formations, clients, import, ateliers, réglages.
import { Link, Navigate, Route, Routes } from 'react-router'
import { BookOpen, CalendarDays, LayoutDashboard, Settings2, Upload, Users } from 'lucide-react'
import { Shell, type NavItem } from '../Shell'
import { FormationsList } from './Formations'
import { FormationEditor } from './FormationEditor'
import { LessonEditor } from './LessonEditor'
import { Clients } from './Clients'
import { ImportParticipants } from './Import'
import { Workshops, WorkshopDetail } from './Workshops'
import { SettingsPage } from './Settings'
import './admin.css'

const NAV: NavItem[] = [
  { to: '/admin/formations', label: 'Formations', short: 'Formations', icon: BookOpen },
  { to: '/admin/clients', label: 'Clients', short: 'Clients', icon: Users },
  { to: '/admin/import', label: 'Import participants', short: 'Import', icon: Upload },
  { to: '/admin/ateliers', label: 'Ateliers', short: 'Ateliers', icon: CalendarDays },
  { to: '/admin/reglages', label: 'Réglages', short: 'Réglages', icon: Settings2 },
]

export default function AdminApp() {
  return (
    <Shell
      items={NAV}
      footer={
        <Link to="/espace" className="side-link">
          <LayoutDashboard aria-hidden="true" />
          <span className="label">Espace client</span>
        </Link>
      }
    >
      <div className="adm-root">
        <Routes>
          <Route index element={<Navigate to="/admin/formations" replace />} />
          <Route path="formations" element={<FormationsList />} />
          <Route path="formations/:id" element={<FormationEditor />} />
          <Route path="formations/:id/lecons/:lessonId" element={<LessonEditor />} />
          <Route path="clients" element={<Clients />} />
          <Route path="import" element={<ImportParticipants />} />
          <Route path="ateliers" element={<Workshops />} />
          <Route path="ateliers/:id" element={<WorkshopDetail />} />
          <Route path="reglages" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/admin/formations" replace />} />
        </Routes>
      </div>
    </Shell>
  )
}
