// Mouvement réduit au strict nécessaire : défilement natif (aucune latence ajoutée),
// pas de parallaxe, pas d'effet magnétique. Les sections apparaissent par un simple fondu.

export const isBrowser = typeof window !== 'undefined'

export const prefersReducedMotion = () =>
  isBrowser && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Saut vers une ancre (défilement natif du navigateur). */
export function scrollToTarget(target: string | HTMLElement, offset = -64, instant = false) {
  if (!isBrowser) return
  const el = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target
  if (!el) return
  scrollToY(el.getBoundingClientRect().top + window.scrollY + offset, instant)
}

export function scrollToY(y: number, instant = false) {
  if (!isBrowser) return
  window.scrollTo({ top: y, behavior: instant || prefersReducedMotion() ? 'auto' : 'smooth' })
}

/**
 * Fondu d'apparition des blocs marqués data-reveal / data-split / data-stagger.
 * Opacité seule, sans déplacement ni flou. Les blocs déjà visibles au chargement ne sont pas masqués.
 */
export function initReveals(root: HTMLElement) {
  if (prefersReducedMotion() || !('IntersectionObserver' in window)) return () => {}
  const els = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal], [data-split], [data-stagger]'))
  const vh = window.innerHeight
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in')
          io.unobserve(e.target)
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px' },
  )
  els.forEach((el) => {
    if (el.getBoundingClientRect().top < vh) return
    el.classList.add('fade')
    io.observe(el)
  })
  return () => io.disconnect()
}

/** Petite interpolation numérique sur requestAnimationFrame (compteur du calculateur). */
export function tweenNumber(from: number, to: number, ms: number, onUpdate: (v: number) => void) {
  if (prefersReducedMotion() || ms <= 0) {
    onUpdate(to)
    return () => {}
  }
  const start = performance.now()
  let raf = requestAnimationFrame(function step(now) {
    const t = Math.min(1, (now - start) / ms)
    const e = 1 - Math.pow(1 - t, 3)
    onUpdate(from + (to - from) * e)
    if (t < 1) raf = requestAnimationFrame(step)
  })
  return () => cancelAnimationFrame(raf)
}
