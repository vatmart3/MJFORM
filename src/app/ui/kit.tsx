// Composants d'interface partagés par l'espace client et l'admin.
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/** Courbe et durées communes : sortie plus rapide que l'entrée. */
export const EASE = [0.22, 1, 0.36, 1] as const
export const enter = { duration: 0.42, ease: EASE }

/** Apparition en cascade des enfants directs */
export const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}
export const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: enter },
}

export function Page({ children, title, kicker, sub, actions }: { children: ReactNode; title: ReactNode; kicker?: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={enter}>
      <header className="page-head">
        <div className="row between wrap" style={{ alignItems: 'flex-end' }}>
          <div>
            {kicker ? <p className="kicker">{kicker}</p> : null}
            <h1 className="page-title">{title}</h1>
            {sub ? <p className="page-sub">{sub}</p> : null}
          </div>
          {actions}
        </div>
      </header>
      {children}
    </motion.div>
  )
}

export function Button({
  loading,
  variant = 'primary',
  size,
  block,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet'
  size?: 'sm'
  block?: boolean
}) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || loading}
      aria-busy={loading || undefined}
      className={`btn btn-${variant}${size ? ` btn-${size}` : ''}${block ? ' btn-block' : ''} ${className}`.trim()}
    >
      {loading ? <span className="spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  )
}

/** Barre de progression animée au chargement (transformation seulement, pas de largeur). */
export function ProgressBar({ value, label }: { value: number; label: string }) {
  const reduce = useReducedMotion()
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className="bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)}>
      <motion.span initial={{ scaleX: reduce ? v : 0 }} animate={{ scaleX: v }} transition={{ duration: 0.9, ease: EASE }} />
    </div>
  )
}

export function ProgressRing({ value, size = 64, stroke = 6, label, children }: { value: number; size?: number; stroke?: number; label: string; children?: ReactNode }) {
  const reduce = useReducedMotion()
  const v = Math.max(0, Math.min(1, value))
  const r = (size - stroke) / 2
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }} role="img" aria-label={label}>
      <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle className="track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <motion.circle
          className="value"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ pathLength: reduce ? v : 0 }}
          animate={{ pathLength: v }}
          transition={{ duration: 1.1, ease: EASE }}
        />
      </svg>
      {children ? (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }} aria-hidden="true">
          {children}
        </div>
      ) : null}
    </div>
  )
}

/** Compteur qui monte jusqu'à sa valeur */
export function Counter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduce = useReducedMotion()
  const from = useRef(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduce) {
      el.textContent = `${value}${suffix}`
      from.current = value
      return
    }
    const start = performance.now()
    const a = from.current
    let raf = requestAnimationFrame(function tick(t) {
      const k = Math.min(1, (t - start) / 700)
      const e = 1 - Math.pow(1 - k, 3)
      el.textContent = `${Math.round(a + (value - a) * e)}${suffix}`
      if (k < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    })
    return () => cancelAnimationFrame(raf)
  }, [value, suffix, reduce])
  return <span ref={ref}>{`${value}${suffix}`}</span>
}

/** Coche qui se dessine */
export function CheckDraw({ done, size = 22 }: { done: boolean; size?: number }) {
  const reduce = useReducedMotion()
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flex: 'none' }}>
      <motion.circle
        cx="12"
        cy="12"
        r="10.5"
        fill={done ? 'var(--blue)' : 'transparent'}
        stroke={done ? 'var(--blue)' : 'var(--border-strong)'}
        strokeWidth="1.5"
        animate={{ scale: done && !reduce ? [1, 1.12, 1] : 1 }}
        transition={{ duration: 0.35 }}
        style={{ transformOrigin: 'center' }}
      />
      <motion.path
        d="M7.5 12.4l3 3 6-6.4"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={false}
        animate={{ pathLength: done ? 1 : 0, opacity: done ? 1 : 0 }}
        transition={{ duration: reduce ? 0 : 0.35, ease: EASE, delay: reduce ? 0 : 0.08 }}
      />
    </svg>
  )
}

export function Skeleton({ h = 16, w = '100%', r }: { h?: number; w?: number | string; r?: number }) {
  return <span className="skel" style={{ height: h, width: w, borderRadius: r }} aria-hidden="true" />
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden="true">
        {icon}
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  )
}

export function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {url ? <img src={url} alt="" width={size} height={size} /> : initials || '·'}
    </span>
  )
}

/** Fenêtre modale accessible : focus piégé, Échap pour fermer, retour du focus. */
export function Modal({ open, onClose, title, children, labelledBy = 'modal-title' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; labelledBy?: string }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const el = box.current
    const focusables = () => Array.from(el?.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []).filter((x) => !x.hasAttribute('disabled'))
    requestAnimationFrame(() => focusables()[0]?.focus())
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab') {
        const f = focusables()
        if (!f.length) return
        const first = f[0]
        const last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      previous?.focus()
    }
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div
            ref={box}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16, transition: { duration: 0.15 } }}
            transition={enter}
          >
            <div className="row between" style={{ alignItems: 'flex-start' }}>
              <h2 id={labelledBy}>{title}</h2>
              <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer" style={{ marginTop: -10, marginRight: -10 }}>
                <X />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}

/** Prix avec ancien prix barré si réduction */
export function Price({ price, final, size = 'md' }: { price: number; final: number; size?: 'md' | 'lg' }) {
  const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: n % 1 ? 2 : 0 }).format(n)
  const big = size === 'lg'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: big ? 28 : 18 }}>
      {final < price ? (
        <s className="muted" style={{ fontWeight: 500, fontSize: big ? 18 : 14 }} aria-label={`Au lieu de ${fmt(price)}`}>
          {fmt(price)}
        </s>
      ) : null}
      {fmt(final)}
    </span>
  )
}
