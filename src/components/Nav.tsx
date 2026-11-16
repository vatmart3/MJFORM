import { useEffect, useState } from 'react'
import { scrollToTarget } from '../lib/motion'
import { BookLink, Logo } from './ui'

const LINKS = [
  { href: '#video', label: 'Vidéo' },
  { href: '#demo', label: 'L’atelier' },
  { href: '#ateliers', label: 'Ateliers et tarifs' },
  { href: '#temps', label: 'Calculateur' },
  { href: '#faq', label: 'Questions' },
]

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <header className={`nav${scrolled ? ' scrolled' : ''}`}>
      <div className="wrap">
        <Logo />
        <nav aria-label="Navigation principale">
          <ul className="nav-links">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={(e) => {
                    e.preventDefault()
                    scrollToTarget(l.href)
                  }}
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <BookLink className="btn btn-primary btn-sm">Réserver</BookLink>
      </div>
    </header>
  )
}
