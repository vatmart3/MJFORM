// Application espace client (/espace) et back-office (/admin).
import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { MotionConfig } from 'motion/react'
import '@fontsource/lora/latin-400.css'
import '@fontsource/lora/latin-400-italic.css'
import '@fontsource-variable/inter/index.css'
import '../styles/global.css'
import './app.css'
import './theme.css'
import { SessionProvider, useSession } from './state'
import { ToastProvider } from './ui/toast'
import { Skeleton } from './ui/kit'
import { Login } from './Login'
import { espaceOpen } from './data'
import { CONTACT } from '../config'
import { previewAllowed } from './preview'

const EspaceApp = lazy(() => import('./espace/EspaceApp'))
const AdminApp = lazy(() => import('./admin/AdminApp'))

document.body.classList.add('app')

function Loading() {
  return (
    <div style={{ padding: 32, maxWidth: 720, margin: '80px auto', display: 'grid', gap: 16 }} aria-busy="true" aria-label="Chargement">
      <Skeleton h={36} w="50%" />
      <Skeleton h={18} w="80%" />
      <Skeleton h={160} r={20} />
    </div>
  )
}

/** Production sans Supabase : l'espace n'est pas encore ouvert */
function Soon() {
  return (
    <div className="login">
      <div className="login-card">
        <a className="logo" href="/" aria-label="MJ FORM, retour au site" style={{ fontSize: 22 }}>
          MJ<span className="dot">.</span> FORM
        </a>
        <h1 className="page-title" style={{ fontSize: 30, marginTop: 28 }}>
          Votre espace ouvre bientôt.
        </h1>
        <p className="page-sub">
          Après votre réservation, vous recevez par e-mail un lien pour vous connecter. Vous y retrouverez les vidéos, supports et prompts de vos ateliers.
        </p>
        <p className="small muted" style={{ marginTop: 20 }}>
          Une question ? <a href={CONTACT.tel}>{CONTACT.phone}</a> · <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
        </p>
        <a className="btn btn-primary" href="/#reserver" style={{ marginTop: 24 }}>
          Réserver un atelier
        </a>
      </div>
    </div>
  )
}

function Gate({ area }: { area: 'espace' | 'admin' }) {
  if (!espaceOpen) return <Soon />
  return <GateOpen area={area} />
}

function GateOpen({ area }: { area: 'espace' | 'admin' }) {
  const { user, loading } = useSession()
  if (loading) return <Loading />
  if (!user) return <Login area={area} />
  if (area === 'admin' && user.role !== 'admin') return <Navigate to="/espace" replace />
  // Compte admin sur /espace : direction l'administration (sauf aperçu demandé)
  if (area === 'espace' && user.role === 'admin' && !previewAllowed()) return <Navigate to="/admin" replace />
  return <Suspense fallback={<Loading />}>{area === 'admin' ? <AdminApp /> : <EspaceApp />}</Suspense>
}

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <SessionProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/espace/*" element={<Gate area="espace" />} />
              <Route path="/admin/*" element={<Gate area="admin" />} />
              <Route path="*" element={<Navigate to="/espace" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </SessionProvider>
    </MotionConfig>
  </StrictMode>,
)
