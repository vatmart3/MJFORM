import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import '@fontsource/poppins/latin-700.css'
import '@fontsource-variable/inter/index.css'
import './styles/global.css'
import App from './App'

const container = document.getElementById('root')!
const app = (
  <StrictMode>
    <App />
  </StrictMode>
)

// Le HTML est pré-rendu au build : on hydrate. En développement, rendu classique.
if (container.firstElementChild) hydrateRoot(container, app)
else createRoot(container).render(app)

// Écran de chargement : progression réelle (page, application, polices), puis fondu.
const loader = document.getElementById('loader')
const setProgress = (p: number) => loader?.style.setProperty('--p', String(p))
setProgress(0.6)
const MIN_MS = 600
const started = performance.now()
const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve()
const pageLoaded =
  document.readyState === 'complete' ? Promise.resolve() : new Promise((r) => window.addEventListener('load', r, { once: true }))

Promise.all([fontsReady.then(() => setProgress(0.8)), pageLoaded])
  .then(() => new Promise((r) => setTimeout(r, Math.max(0, MIN_MS - (performance.now() - started)))))
  .then(() => {
    setProgress(1)
    setTimeout(() => {
      loader?.classList.add('done')
      ;(window as Window & { mjformReady?: boolean }).mjformReady = true
      window.dispatchEvent(new Event('mjform:ready'))
      setTimeout(() => loader?.remove(), 400)
    }, 250)
  })
