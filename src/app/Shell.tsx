// Coquille de navigation : barre latérale fine et rétractable (ordinateur),
// barre d'onglets en bas (mobile). Les mêmes entrées servent aux deux.
import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router'
import { motion } from 'motion/react'
import { LogOut, PanelLeftClose, PanelLeftOpen, type LucideIcon } from 'lucide-react'
import { useBackend, useSession } from './state'
import { Avatar } from './ui/kit'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Libellé court pour la barre d'onglets mobile */
  short?: string
  end?: boolean
}

const COLLAPSE_KEY = 'mjform-side-collapsed'

/** Lien vers l'autre espace (admin ↔ stagiaire), affiché aussi sur téléphone */
export interface SwitchLink {
  to: string
  label: string
  onClick?: () => void
}

export function Shell({
  items,
  children,
  footer,
  switchTo,
}: {
  items: NavItem[]
  children: ReactNode
  footer?: ReactNode
  switchTo?: SwitchLink
}) {
  const { user } = useSession()
  const backend = useBackend()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])
  // Chaque nouvelle page repart du haut
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  const name = user ? `${user.firstName} ${user.lastName}`.trim() || user.email : ''

  return (
    <div className={`shell${collapsed ? ' collapsed' : ''}`}>
      <a className="skip" href="#contenu">
        Aller au contenu
      </a>
      <aside className="side" aria-label="Navigation principale">
        <div className="side-head">
          <a className="logo" href="/" aria-label="MJ FORM, retour au site">
            MJ<span className="dot">.</span>
            <span className="full"> FORM</span>
          </a>
          {!collapsed ? (
            <button type="button" className="icon-btn" onClick={() => setCollapsed(true)} aria-label="Réduire la barre latérale">
              <PanelLeftClose />
            </button>
          ) : null}
        </div>
        {collapsed ? (
          <button type="button" className="icon-btn" style={{ margin: '0 auto 8px' }} onClick={() => setCollapsed(false)} aria-label="Déplier la barre latérale">
            <PanelLeftOpen />
          </button>
        ) : null}
        <nav>
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end} className="side-link" title={collapsed ? it.label : undefined}>
              <it.icon aria-hidden="true" />
              <span className="label">{it.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          {footer}
          <div className="side-link" style={{ cursor: 'default' }} title={collapsed ? name : undefined}>
            <Avatar name={name} url={user?.avatarUrl} size={28} />
            <span className="label" style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 14 }}>
              {name}
            </span>
          </div>
          <button type="button" className="side-link" style={{ border: 0, background: 'none', cursor: 'pointer', width: '100%' }} onClick={() => backend.signOut()}>
            <LogOut aria-hidden="true" />
            <span className="label">Se déconnecter</span>
          </button>
        </div>
      </aside>

      <header className="topbar">
        <a className="logo" href="/" aria-label="MJ FORM, retour au site" style={{ fontSize: 19 }}>
          MJ<span className="dot">.</span> FORM
        </a>
        <div className="topbar-actions">
          {switchTo ? (
            <NavLink to={switchTo.to} className="topbar-switch" onClick={switchTo.onClick}>
              {switchTo.label}
            </NavLink>
          ) : null}
          <button type="button" className="icon-btn topbar-out" onClick={() => backend.signOut()} aria-label="Se déconnecter">
            <LogOut aria-hidden="true" />
          </button>
          <Avatar name={name} url={user?.avatarUrl} size={32} />
        </div>
      </header>

      <main id="contenu" className="main">
        {/* Fondu d'entrée à chaque changement de page (sans attente de sortie : aucun écran vide) */}
        <motion.div key={location.pathname.split('/').slice(0, 4).join('/')} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
          {children}
        </motion.div>
      </main>

      <nav className="tabbar" aria-label="Navigation">
        {items.slice(0, 6).map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end}>
            <it.icon aria-hidden="true" />
            {it.short ?? it.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
