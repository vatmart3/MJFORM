import type { ElementType, MouseEvent, ReactNode } from 'react'
import { atelierById } from '../data/ateliers'
import { scrollToTarget } from '../lib/motion'
import { selection } from '../lib/store'

export function Logo({ href = '/' }: { href?: string }) {
  return (
    <a className="logo" href={href} aria-label="MJ FORM, accueil">
      MJ<span className="dot">.</span> FORM
    </a>
  )
}

/** Découpe un texte en mots enveloppés pour l'apparition mot par mot. */
function Words({ text }: { text: string }) {
  const words = text.split(' ')
  return (
    <>
      {words.map((w, i) => (
        <span key={i}>
          <span className="w">
            <span>{w}</span>
          </span>
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </>
  )
}

/** Titre en deux temps : « Votre commerce. Augmenté. » */
export function SplitTitle({
  as: Tag = 'h2',
  first,
  second,
  className = 'title',
  id,
}: {
  as?: ElementType
  first: string
  second?: string
  className?: string
  id?: string
}) {
  return (
    <Tag className={className} data-split="" id={id}>
      <Words text={first} />
      {second ? (
        <>
          {' '}
          <br />
          <span className="second">
            <Words text={second} />
          </span>
        </>
      ) : null}
    </Tag>
  )
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="eyebrow" data-reveal="">
      {children}
    </p>
  )
}

/** Pré-sélectionne un atelier (et éventuellement une session) puis descend au configurateur. */
export function goBook(atelierId?: string, sessionId?: string) {
  const a = atelierId ? atelierById(atelierId) : undefined
  selection.set((s) => ({
    level: a ? a.level : s.level,
    atelierId: a ? a.id : s.atelierId,
    sessionId: sessionId ?? (a ? null : s.sessionId),
  }))
  scrollToTarget('#reserver')
}

export function BookLink({
  atelierId,
  sessionId,
  children = 'Réserver ma place',
  className = 'link-arrow',
}: {
  atelierId?: string
  sessionId?: string
  children?: ReactNode
  className?: string
}) {
  const onClick = (e: MouseEvent) => {
    e.preventDefault()
    goBook(atelierId, sessionId)
  }
  return (
    <a href="#reserver" className={className || undefined} onClick={onClick}>
      {children}
    </a>
  )
}

/** Appel à l'action placé après chaque section. */
export function SectionCta({ secondary }: { secondary?: { href: string; label: string } }) {
  return (
    <div className="section-cta" data-reveal="">
      <BookLink />
      {secondary ? (
        <a
          className="link-arrow"
          href={secondary.href}
          onClick={(e) => {
            if (secondary.href.startsWith('#')) {
              e.preventDefault()
              scrollToTarget(secondary.href)
            }
          }}
        >
          {secondary.label}
        </a>
      ) : null}
    </div>
  )
}

export function Icon({ name }: { name: 'group' | 'phone' | 'cup' | 'check' }) {
  const common = {
    className: 'icon',
    viewBox: '0 0 44 44',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  if (name === 'group')
    return (
      <svg {...common}>
        <circle cx="16" cy="15" r="5.5" />
        <circle cx="30" cy="17" r="4.5" />
        <path d="M6 35c0-6 4.5-10 10-10s10 4 10 10M27 26.5c5.5-1 11 2.5 11 8.5" />
      </svg>
    )
  if (name === 'phone')
    return (
      <svg {...common}>
        <rect x="13" y="5" width="18" height="34" rx="4.5" />
        <path d="M19.5 33.5h5" />
        <path d="M18 18l3 3 5.5-6" />
      </svg>
    )
  if (name === 'cup')
    return (
      <svg {...common}>
        <path d="M9 17h22v9a10 10 0 0 1-10 10h-2A10 10 0 0 1 9 26z" />
        <path d="M31 20h2.5a4.5 4.5 0 0 1 0 9H31" />
        <path d="M15 6c-1.5 2 1.5 4 0 6M21 6c-1.5 2 1.5 4 0 6M27 6c-1.5 2 1.5 4 0 6" />
      </svg>
    )
  return (
    <svg {...common}>
      <path d="M10 23l8 8 16-17" />
    </svg>
  )
}
