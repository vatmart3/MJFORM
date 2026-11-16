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
