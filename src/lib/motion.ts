import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger)

export { gsap, ScrollTrigger }

export const isBrowser = typeof window !== 'undefined'

export const prefersReducedMotion = () =>
  isBrowser && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const hasFinePointer = () => isBrowser && window.matchMedia('(hover: hover) and (pointer: fine)').matches

/** Courbes « ressort » façon Apple, utilisées par GSAP (les mêmes existent en CSS via linear()). */
export const EASE = {
  out: 'expo.out',
  spring: 'back.out(1.25)',
  soft: 'power3.out',
}

let lenis: Lenis | null = null

export function initSmoothScroll() {
  if (!isBrowser || prefersReducedMotion() || lenis) return lenis
  // lerp bas = défilement plus doux et plus « glissé », sans perdre en réactivité
  lenis = new Lenis({ lerp: 0.075, wheelMultiplier: 0.85, touchMultiplier: 1.1, smoothWheel: true })
  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add((time) => lenis?.raf(time * 1000))
  gsap.ticker.lagSmoothing(0)
  return lenis
}

/** Défilement vers une ancre, fluide si Lenis est actif. */
export function scrollToTarget(target: string | HTMLElement, offset = -64) {
  if (!isBrowser) return
  const el = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target
  if (!el) return
  if (lenis) {
    lenis.scrollTo(el, { offset, duration: 1.3 })
  } else {
    const y = el.getBoundingClientRect().top + window.scrollY + offset
    window.scrollTo({ top: y, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }
}

export function scrollToY(y: number) {
  if (!isBrowser) return
  if (lenis) lenis.scrollTo(y, { duration: 1.2 })
  else window.scrollTo({ top: y, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
}

/** Animations d'entrée : titres mot par mot, fondus et légers flous. */
export function initReveals(root: HTMLElement) {
  if (prefersReducedMotion()) return () => {}
  const ctx = gsap.context(() => {
    gsap.utils.toArray<HTMLElement>('[data-split]').forEach((title) => {
      const words = title.querySelectorAll<HTMLElement>('.w > span')
      gsap.from(words, {
        yPercent: 110,
        opacity: 0,
        filter: 'blur(6px)',
        duration: 1.1,
        ease: EASE.out,
        stagger: 0.06,
        scrollTrigger: { trigger: title, start: 'top 88%', once: true },
      })
    })
    gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
      const delay = Number(el.dataset.revealDelay || 0)
      gsap.from(el, {
        y: 28,
        opacity: 0,
        filter: 'blur(10px)',
        duration: 1.2,
        delay,
        ease: EASE.out,
        clearProps: 'filter',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      })
    })
    gsap.utils.toArray<HTMLElement>('[data-stagger]').forEach((group) => {
      gsap.from(group.children, {
        y: 36,
        opacity: 0,
        scale: 0.97,
        filter: 'blur(8px)',
        duration: 1.1,
        ease: EASE.spring,
        stagger: 0.08,
        clearProps: 'filter,transform',
        scrollTrigger: { trigger: group, start: 'top 85%', once: true },
      })
    })
  }, root)
  return () => ctx.revert()
}

/** Effet magnétique sur les boutons (pointeur fin uniquement). */
export function initMagnetic(root: HTMLElement) {
  if (prefersReducedMotion() || !hasFinePointer()) return () => {}
  const cleanups: Array<() => void> = []
  root.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
    const strength = Number(el.dataset.magnetic || 0.35)
    const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: EASE.soft })
    const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: EASE.soft })
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      xTo((e.clientX - (r.left + r.width / 2)) * strength)
      yTo((e.clientY - (r.top + r.height / 2)) * strength)
    }
    const leave = () => gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)' })
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    cleanups.push(() => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
    })
  })
  return () => cleanups.forEach((fn) => fn())
}
