// Application espace client (/espace) et back-office (/admin).
import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { MotionConfig } from 'motion/react'
import '@fontsource/poppins/latin-600.css'
import '@fontsource/poppins/latin-700.css'
import '@fontsource-variable/inter/index.css'
import '../styles/global.css'
import './app.css'
import { SessionProvider, useSession } from './state'
import { ToastProvider } from './ui/toast'
import { Skeleton } from './ui/kit'
import { Login } from './Login'

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

function Gate({ area }: { area: 'espace' | 'admin' }) {
  const { user, loading } = useSession()
  if (loading) return <Loading />
  if (!user) return <Login area={area} />
  if (area === 'admin' && user.role !== 'admin') return <Navigate to="/espace" replace />
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
