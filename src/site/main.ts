// Site MJ FORM : interactions et animations (GSAP + ScrollTrigger + SplitText, défilement natif).
import '@fontsource/lora/latin-400.css'
import '@fontsource/lora/latin-400-italic.css'
import '@fontsource-variable/inter/index.css'
import './styles/base.css'
import './styles/home.css'
import './styles/pages.css'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { Flip } from 'gsap/Flip'
import { PILOT_SESSION_ID } from '../data/sessions.ts'

gsap.registerPlugin(ScrollTrigger, SplitText, Flip)
ScrollTrigger.config({ ignoreMobileResize: true })

const root = document.documentElement
const $ = <T extends Element = HTMLElement>(sel: string, scope: ParentNode = document) => scope.querySelector<T>(sel)
const $$ = <T extends Element = HTMLElement>(sel: string, scope: ParentNode = document) =>
  Array.from(scope.querySelectorAll<T>(sel))

/* ——— En-tête : fond au défilement, se cache en descendant, menu mobile ——— */
function header() {
  const el = $('[data-header]')
  if (!el) return
  const toggle = $<HTMLButtonElement>('[data-menu-toggle]', el)
  const sheet = $('[data-menu]')
  let open = false
  const setOpen = (v: boolean) => {
    open = v
    toggle?.setAttribute('aria-expanded', String(v))
    if (sheet) sheet.hidden = !v
    root.style.overflow = v ? 'hidden' : ''
    el.classList.toggle('is-scrolled', v || scrollY > 24)
    if (v && sheet && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.from($$('li, .menu-contact', sheet), { y: 24, autoAlpha: 0, duration: 0.6, stagger: 0.04, ease: 'expo.out' })
    }
  }
  toggle?.addEventListener('click', () => setOpen(!open))
  sheet?.addEventListener('click', (e) => {
    if ((e.target as Element).closest('a')) setOpen(false)
  })
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) {
      setOpen(false)
      toggle?.focus()
    }
  })

  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate(self) {
      const y = self.scroll()
      el.classList.toggle('is-scrolled', open || y > 24)
      el.classList.toggle('is-hidden', !open && y > 480 && self.direction === 1)
    },
  })

  // Lien de navigation de la page courante
  const page = document.body.dataset.page
  for (const a of $$<HTMLAnchorElement>('[data-nav]')) {
    if (a.dataset.nav === page) a.setAttribute('aria-current', 'page')
  }
}

/* ——— Réservation de l'atelier pilote (Stripe Checkout) ——— */
function checkout() {
  const btn = $<HTMLButtonElement>('[data-checkout]')
  const status = $('[data-checkout-status]')
  if (!btn || !status) return
  const label = btn.textContent
  const fallback =
    'Réservez par téléphone au <a href="tel:+33611718368">06 11 71 83 68</a> ou par e-mail à <a href="mailto:mjagency.officiel@gmail.com">mjagency.officiel@gmail.com</a>.'
  btn.addEventListener('click', async () => {
    btn.disabled = true
    btn.textContent = 'Un instant…'
    status.textContent = ''
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: PILOT_SESSION_ID, atelierId: 'fetes', format: 'presentiel' }),
      })
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (res.ok && data.url) {
        location.href = data.url
        return
      }
      const reason =
        data.error === 'full'
          ? 'Cet atelier est complet. '
          : data.error === 'session-past'
            ? 'Les réservations pour cet atelier sont closes. '
            : 'Le paiement en ligne est momentanément indisponible. '
      status.innerHTML = reason + fallback
    } catch {
      status.innerHTML = 'Connexion impossible pour le moment. ' + fallback
    }
    btn.disabled = false
    btn.textContent = label
  })
}

/* ——— Micro-interactions (pointeur fin uniquement) ——— */
function microInteractions() {
  // Boutons « aimantés » : suivent légèrement le pointeur
  for (const el of $$('[data-magnetic]')) {
    const x = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' })
    const y = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' })
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect()
      x((e.clientX - r.left - r.width / 2) * 0.18)
      y((e.clientY - r.top - r.height / 2) * 0.28)
    })
    el.addEventListener('pointerleave', () => {
      x(0)
      y(0)
    })
  }
  // Cartes inclinées en 3D au survol
  for (const el of $$('[data-tilt]')) {
    gsap.set(el, { transformPerspective: 800 })
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3.out' })
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3.out' })
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect()
      ry(((e.clientX - r.left) / r.width - 0.5) * 10)
      rx(-((e.clientY - r.top) / r.height - 0.5) * 10)
    })
    el.addEventListener('pointerleave', () => {
      rx(0)
      ry(0)
    })
  }
}

/* ——— Bandeau : défilement continu, accéléré par la vitesse de défilement ——— */
function ribbon() {
  const track = $('[data-ribbon]')
  if (!track) return
  track.append(...Array.from(track.children).map((n) => n.cloneNode(true)))
  const loop = gsap.to(track, { xPercent: -50, duration: 38, ease: 'none', repeat: -1 })
  let boost = gsap.to({}, {})
  ScrollTrigger.create({
    trigger: track,
    start: 'top bottom',
    end: 'bottom top',
    onUpdate(self) {
      const v = gsap.utils.clamp(-4, 4, self.getVelocity() / 400)
      boost.kill()
      loop.timeScale(1 + Math.abs(v))
      boost = gsap.to(loop, { timeScale: 1, duration: 0.9, ease: 'power2.out' })
    },
  })
}

/** Attente des polices (pour découper les titres au bon endroit), sans bloquer plus de 900 ms. */
const fontsReady = () => Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 900))])

/* ——— Entrée du hero ——— */
async function heroIntro() {
  const hero = $('[data-hero]')
  if (!hero) return root.classList.remove('anim')
  await fontsReady()

  const title = $('.hero-title', hero)!
  const em = $('em', title)
  const split = SplitText.create(title, { aria: 'none', type: 'lines,words', mask: 'lines', linesClass: 'split-line' })
  const pieces = $$('.piece', hero)
  const ins = $$('.hero-in', hero)
  const ticket = $('.hero-ticket', hero)

  gsap.set(split.words, { yPercent: 115 })
  if (em) gsap.set(em, { '--hl': '0%' })
  gsap.set(pieces, {
    autoAlpha: 0,
    yPercent: () => gsap.utils.random(60, 120),
    xPercent: (i) => (pieces[i].getBoundingClientRect().left < innerWidth / 2 ? -40 : 40),
    rotation: () => gsap.utils.random(-26, 26),
    scale: 0.7,
  })
  gsap.set(ins, { autoAlpha: 0, y: 24 })
  if (ticket) gsap.set(ticket, { autoAlpha: 0, y: 60, rotation: 6 })
  root.classList.remove('anim')

  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })
  tl.from('[data-hero-frame]', { clipPath: 'inset(3% 3% 3% 3% round 32px)', duration: 1.4, ease: 'expo.inOut' }, 0)
    .from('.hero-texture', { autoAlpha: 0, duration: 1.2, ease: 'power2.out' }, 0.2)
    .from('[data-header]', { y: -30, autoAlpha: 0, duration: 1 }, 0.5)
    .to(ins[0], { autoAlpha: 1, y: 0, duration: 1 }, 0.35)
    .to(split.words, { yPercent: 0, duration: 1.25, stagger: 0.045 }, 0.42)
    .to(pieces, { autoAlpha: 1, xPercent: 0, yPercent: 0, rotation: 0, scale: 1, duration: 1.6, stagger: 0.07 }, 0.55)
    .to(ins.slice(1), { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.1 }, 1)
  if (em) tl.to(em, { '--hl': '100%', duration: 0.9, ease: 'power3.inOut' }, 1.25)
  if (ticket) tl.to(ticket, { autoAlpha: 1, y: 0, rotation: 0, duration: 1.2 }, 1.2)
  const lines = $$('.chat-lines i', hero)
  if (lines.length) tl.from(lines, { scaleX: 0, duration: 0.7, stagger: 0.18, ease: 'power2.out' }, 1.6)
  tl.set('[data-hero-frame]', { clearProps: 'clipPath' })
  // Titre rendu à son état d'origine : plus aucun masque qui pourrait rogner les lettres
  tl.call(() => split.revert())
}

/* ——— Titres de section : lignes qui montent ——— */
async function revealTitles() {
  await fontsReady()
  for (const el of $$('[data-reveal]')) {
    const split = SplitText.create(el, { aria: 'none', type: 'lines', mask: 'lines', linesClass: 'split-line' })
    gsap.from(split.lines, {
      yPercent: 105,
      duration: 1.1,
      stagger: 0.09,
      ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 86%', once: true },
      // Une fois le titre arrivé, on retire le découpage (aucune lettre rognée, retour à la ligne naturel)
      onComplete: () => split.revert(),
    })
  }
}

/* ——— Animations liées au défilement ——— */
function scrollScenes(wide: boolean) {
  const depth = (el: Element) => Number((el as HTMLElement).dataset.depth ?? 1)

  // Hero : la page « recule » et les papiers s'envolent à des vitesses différentes
  const hero = $('[data-hero]')
  if (hero) {
    // (propriétés distinctes de l'entrée : y ici, xPercent/yPercent/rotation/scale à l'entrée)
    const tl = gsap.timeline({
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
    })
    tl.to('[data-hero-frame]', { scale: 0.92, borderRadius: 40, ease: 'none' }, 0)
      .to('.hero-content', { y: () => innerHeight * 0.18, autoAlpha: 0.15, ease: 'none' }, 0)
      .to('[data-collage]', { scale: 1.12, ease: 'none' }, 0)
    if ($('.hero-ticket', hero)) tl.to('.hero-ticket', { yPercent: -60, ease: 'none' }, 0)
    for (const p of $$('.piece', hero)) {
      tl.to(p, { y: () => -depth(p) * innerHeight * 0.32, ease: 'none' }, 0)
    }
  }

  // Constat : les mots s'allument au fil de la lecture, puis le surligneur passe
  const constat = $('[data-constat]')
  if (constat) {
    const text = $('[data-words]', constat)!
    const split = SplitText.create(text, { aria: 'none', type: 'words', wordsClass: 'word' })
    const marks = $$('[data-mark]', constat)
    gsap.set(marks, { '--hl': '0%' })
    const tl = gsap.timeline({
      scrollTrigger: wide
        ? { trigger: constat, start: 'top top', end: '+=110%', scrub: true, pin: true, anticipatePin: 1 }
        : { trigger: text, start: 'top 80%', end: 'bottom 45%', scrub: true },
    })
    tl.fromTo(split.words, { opacity: 0.2 }, { opacity: 1, stagger: 0.1, ease: 'none' }).to(
      marks,
      { '--hl': '100%', stagger: 0.35, duration: 1.2, ease: 'power1.inOut' },
      '-=1.6',
    )
    tl.from('.constat-sign', { autoAlpha: 0, y: 16, duration: 1 }, '-=0.6')
    for (const n of $$('.note', constat)) {
      gsap.fromTo(
        n,
        { y: depth(n) * 120 },
        { y: -depth(n) * 120, ease: 'none', scrollTrigger: { trigger: constat, start: 'top bottom', end: 'bottom top', scrub: true } },
      )
    }
  }

  // Méthode : les cartes se posent comme des papiers sur la table
  const pillars = $$('[data-pillars] > *')
  if (pillars.length) {
    gsap.from(pillars, {
      y: 90,
      rotation: (i) => (i % 2 ? 5 : -5),
      autoAlpha: 0,
      duration: 1.2,
      stagger: 0.1,
      ease: 'expo.out',
      scrollTrigger: { trigger: '[data-pillars]', start: 'top 82%', once: true },
    })
  }

  // Ateliers & formations : défilement horizontal épinglé (grand écran)
  const track = $('[data-offres-track]')
  const offres = $$('[data-offre]')
  if (track && wide) {
    const pin = $('[data-offres-pin]')!
    const distance = () => Math.max(0, track.scrollWidth - pin.clientWidth)
    const tween = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: '[data-offres-pin]',
        start: 'top top',
        end: () => '+=' + distance(),
        pin: true,
        scrub: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    })
    gsap.to('[data-offres-bar]', {
      scale: 1,
      ease: 'none',
      scrollTrigger: { trigger: '[data-offres-pin]', start: 'top top', end: () => '+=' + distance(), scrub: true },
    })
    for (const o of offres) {
      const card = $('.offre-card', o)
      const paper = $('.offre-paper', o)
      gsap.fromTo(
        card,
        { rotation: 5, y: 40 },
        {
          rotation: 0,
          y: 0,
          ease: 'none',
          scrollTrigger: { trigger: o, containerAnimation: tween, start: 'left right', end: 'center center', scrub: true },
        },
      )
      gsap.fromTo(
        paper,
        { xPercent: 14, rotation: -12 },
        {
          xPercent: -6,
          rotation: 4,
          ease: 'none',
          scrollTrigger: { trigger: o, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true },
        },
      )
    }
  } else if (offres.length) {
    for (const o of offres) {
      gsap.from(o, {
        y: 80,
        rotation: 3,
        autoAlpha: 0,
        duration: 1.1,
        ease: 'expo.out',
        scrollTrigger: { trigger: o, start: 'top 88%', once: true },
      })
    }
  }

  // Deux formats : les cartes glissent depuis les côtés
  const formats = $$('[data-formats] > *')
  if (formats.length) {
    const tl = gsap.timeline({
      scrollTrigger: { trigger: '[data-formats]', start: 'top 92%', end: wide ? 'top 40%' : 'top 60%', scrub: true },
    })
    formats.forEach((f, i) => {
      const dir = i % 2 ? 1 : -1
      tl.from(f, { x: wide ? dir * 140 : 0, y: wide ? 40 : 60, rotation: dir * 5, autoAlpha: 0, ease: 'power2.out' }, i * 0.12)
      tl.from($('.format-paper', f), { rotation: 60, scale: 0.6, ease: 'power2.out' }, i * 0.12)
    })
  }

  // Espace stagiaire : la maquette s'assemble pièce par pièce
  const mock = $('[data-mock]')
  if (mock) {
    const tl = gsap.timeline({
      defaults: { ease: 'power2.out' },
      scrollTrigger: { trigger: mock, start: 'top 90%', end: 'center 55%', scrub: true },
    })
    tl.from('.mock-window', { rotationX: 22, rotationY: -10, y: 80, scale: 0.9, transformOrigin: '50% 100%' }, 0)
      .from('.mock-paper', { rotation: -24, scale: 0.7, autoAlpha: 0 }, 0)
      .from($$('[data-mock-part]', mock).slice(1), { y: 26, autoAlpha: 0, stagger: 0.08 }, 0.15)
      .from('[data-mock-fill]', { scaleX: 0 }, 0.5)
      .from('.mock-video', { x: -90, y: 30, rotation: -18, autoAlpha: 0 }, 0.35)
      .from('.mock-referral', { x: 90, y: 30, rotation: 18, autoAlpha: 0 }, 0.45)
  }

  // Agenda : le billet se pose, les créneaux suivent
  const event = $('[data-event]')
  if (event) {
    gsap
      .timeline({ scrollTrigger: { trigger: event, start: 'top 85%', once: true }, defaults: { ease: 'expo.out' } })
      .from('.event-paper', { rotation: -9, scale: 0.92, autoAlpha: 0, duration: 1.3 }, 0)
      .from('.event-card', { y: 90, rotation: 2.5, autoAlpha: 0, duration: 1.3 }, 0.08)
      .from('.event-day', { yPercent: 40, autoAlpha: 0, duration: 1.1 }, 0.4)
      .from('.tape-event', { scale: 0, rotation: -70, duration: 0.8, ease: 'back.out(2)' }, 0.75)
    gsap.from('[data-slots] > *', {
      y: 50,
      autoAlpha: 0,
      stagger: 0.12,
      duration: 1,
      ease: 'expo.out',
      scrollTrigger: { trigger: '[data-slots]', start: 'top 88%', once: true },
    })
  }

  // À propos : villes et citation
  const towns = $$('[data-towns] > *')
  if (towns.length) {
    gsap.from(towns, {
      scale: 0.6,
      y: 20,
      autoAlpha: 0,
      stagger: 0.08,
      duration: 0.9,
      ease: 'back.out(1.6)',
      scrollTrigger: { trigger: '[data-towns]', start: 'top 90%', once: true },
    })
  }
  const quote = $('[data-quote]')
  if (quote) {
    gsap
      .timeline({ scrollTrigger: { trigger: quote, start: 'top 90%', end: 'center 50%', scrub: true } })
      .from('.quote-paper', { rotation: 18, xPercent: 12, ease: 'none' }, 0)
      .from('.quote-card', { rotation: -7, y: 70, ease: 'none' }, 0)
  }

  // Contact : le cadre s'ouvre, les papiers flottent
  const contact = $('[data-contact]')
  if (contact) {
    gsap.from('[data-contact-frame]', {
      scale: 0.93,
      borderRadius: 64,
      ease: 'none',
      scrollTrigger: { trigger: contact, start: 'top bottom', end: 'top 35%', scrub: true },
    })
    for (const p of $$('.contact-paper', contact)) {
      gsap.fromTo(
        p,
        { y: depth(p) * 110, rotation: '-=12' },
        {
          y: -depth(p) * 110,
          rotation: '+=12',
          ease: 'none',
          scrollTrigger: { trigger: contact, start: 'top bottom', end: 'bottom top', scrub: true },
        },
      )
    }
    gsap.from('.contact-link', {
      y: 40,
      autoAlpha: 0,
      stagger: 0.1,
      duration: 1,
      ease: 'expo.out',
      scrollTrigger: { trigger: '.contact-links', start: 'top 92%', once: true },
    })
  }

  // Pied de page : le grand MJ FORM émerge lettre par lettre
  const word = $('[data-wordmark]')
  if (word) {
    const split = SplitText.create(word, { aria: 'none', type: 'chars', charsClass: 'char', mask: 'chars' })
    // Joué une fois à l'apparition : sur téléphone, la page ne défile pas assez pour un effet lié au défilement
    gsap.from(split.chars, {
      yPercent: 100,
      stagger: 0.06,
      duration: 1,
      ease: 'expo.out',
      scrollTrigger: { trigger: word, start: 'top 95%', once: true },
      onComplete: () => split.revert(),
    })
  }
}

/* ——— Catalogue : filtres animés (Flip) ——— */
function filters() {
  const bar = $('[data-filters]')
  const catalog = $('[data-catalog]')
  if (!bar || !catalog) return
  const buttons = $$<HTMLButtonElement>('[data-filter]', bar)
  const glider = $('[data-glider]', bar)
  const cards = $$('[data-kind]', catalog)
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches
  const moveGlider = (btn: HTMLElement, animate: boolean) => {
    if (!glider) return
    const vars = { x: btn.offsetLeft - 5, width: btn.offsetWidth }
    if (animate && !reduce()) gsap.to(glider, { ...vars, duration: 0.5, ease: 'expo.out' })
    else gsap.set(glider, vars)
  }
  const current = () => buttons.find((b) => b.classList.contains('is-on')) ?? buttons[0]
  const apply = (kind: string) => {
    const state = Flip.getState(cards)
    for (const c of cards) c.hidden = kind !== 'all' && c.dataset.kind !== kind
    if (reduce()) return
    Flip.from(state, {
      duration: 0.7,
      ease: 'expo.out',
      absolute: true,
      scale: true,
      onEnter: (els) => gsap.fromTo(els, { autoAlpha: 0, scale: 0.92, y: 30 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.6, ease: 'expo.out' }),
      onLeave: (els) => gsap.to(els, { autoAlpha: 0, scale: 0.92, duration: 0.3 }),
      onComplete: () => ScrollTrigger.refresh(),
    })
  }
  for (const b of buttons) {
    b.addEventListener('click', () => {
      for (const o of buttons) {
        o.classList.toggle('is-on', o === b)
        o.setAttribute('aria-pressed', String(o === b))
      }
      moveGlider(b, true)
      apply(b.dataset.filter ?? 'all')
    })
  }
  moveGlider(current(), false)
  fontsReady().then(() => moveGlider(current(), false))
  addEventListener('resize', () => moveGlider(current(), false))
}

/* ——— Questions fréquentes : ouverture animée ——— */
function faq() {
  for (const item of $$<HTMLDetailsElement>('[data-faq] details')) {
    const summary = $('summary', item)!
    const body = $('.faq-body', item)!
    summary.addEventListener('click', (e) => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
      e.preventDefault()
      if (item.open) {
        gsap.to(body, {
          height: 0,
          autoAlpha: 0,
          duration: 0.35,
          ease: 'power2.inOut',
          onComplete: () => {
            item.open = false
            gsap.set(body, { clearProps: 'all' })
          },
        })
      } else {
        item.open = true
        gsap.from(body, { height: 0, autoAlpha: 0, duration: 0.5, ease: 'expo.out', clearProps: 'all' })
      }
    })
  }
}

/* ——— Calendrier du mois (agenda) ——— */
function calendar() {
  for (const el of $$('[data-calendar]')) {
    const [y, m] = (el.dataset.calendar ?? '').split('-').map(Number)
    if (!y || !m) continue
    const on = Number(el.dataset.highlight ?? 0)
    const first = new Date(Date.UTC(y, m - 1, 1))
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const offset = (first.getUTCDay() + 6) % 7 // lundi en premier
    const month = new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' }).format(first)
    let cells = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => `<span class="cal-dow">${d}</span>`).join('')
    cells += '<span></span>'.repeat(offset)
    for (let d = 1; d <= days; d++) {
      const dow = (offset + d - 1) % 7 // 0 = lundi
      const cls = ['cal-day', dow >= 5 ? 'is-weekend' : '', dow === 0 || dow === 4 ? 'is-slot' : '', d === on ? 'is-on' : '']
      cells += `<span class="${cls.filter(Boolean).join(' ')}">${d}</span>`
    }
    el.innerHTML = `<div class="cal-head"><span class="cal-month">${month}</span><span class="cal-year">${y}</span></div>
      <div class="cal-grid">${cells}</div>
      <div class="cal-legend"><span><i></i>Atelier pilote</span><span><i></i>Créneaux habituels</span></div>`
  }
}

/* ——— Formulaires : ouverture de la messagerie avec le message pré-rempli ——— */
function mailtoForms() {
  const key = new URLSearchParams(location.search).get('sujet')
  for (const form of $$<HTMLFormElement>('[data-mailto-form]')) {
    const select = $<HTMLSelectElement>('[data-subject-select]', form)
    if (select && key) {
      const opt = Array.from(select.options).find((o) => o.dataset.key === key)
      if (opt) select.value = opt.value
    }
    const status = $('[data-form-status]', form)
    form.addEventListener('submit', (e) => {
      e.preventDefault()
      let firstInvalid: HTMLElement | null = null
      for (const input of $$<HTMLInputElement | HTMLTextAreaElement>('input, textarea', form)) {
        const ok = input.checkValidity() && (!input.required || input.value.trim() !== '')
        input.setAttribute('aria-invalid', String(!ok))
        if (!ok && !firstInvalid) firstInvalid = input
      }
      if (firstInvalid) {
        firstInvalid.focus()
        if (status) status.textContent = 'Merci de compléter les champs indiqués.'
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) gsap.fromTo(firstInvalid, { x: -6 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' })
        return
      }
      const data = new FormData(form)
      const lines: string[] = []
      for (const [k, v] of data.entries()) if (String(v).trim()) lines.push(`${k} : ${String(v).trim()}`)
      const subject = `${form.dataset.subject ?? 'Message'}${select ? ` · ${select.value}` : ''}`
      const href = `mailto:mjagency.officiel@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`
      location.href = href
      if (status) {
        status.textContent = 'Votre messagerie s’ouvre. Rien ne s’affiche ? Écrivez-nous à mjagency.officiel@gmail.com ou appelez le 06 11 71 83 68.'
        status.classList.add('is-ok')
      }
    })
    form.addEventListener('input', (e) => {
      const t = e.target as HTMLElement
      if (t.getAttribute('aria-invalid') === 'true') t.removeAttribute('aria-invalid')
    })
  }
}

/* ——— Animations des pages intérieures ——— */
function pageScenes() {
  // Tracés qui se dessinent au défilement (arbre, carte, étapes)
  for (const path of $$<SVGPathElement>('path[data-draw]')) {
    const len = path.getTotalLength()
    gsap.fromTo(
      path,
      { strokeDasharray: len, strokeDashoffset: len },
      {
        strokeDashoffset: 0,
        ease: 'none',
        scrollTrigger: { trigger: path.closest('section') ?? path, start: 'top 75%', end: 'center 50%', scrub: true },
      },
    )
  }
  const once = (targets: gsap.TweenTarget, trigger: Element | string, vars: gsap.TweenVars) =>
    gsap.from(targets, {
      autoAlpha: 0,
      duration: 1.1,
      ease: 'expo.out',
      ...vars,
      scrollTrigger: { trigger, start: 'top 85%', once: true },
    })

  const tree = $('[data-tree]')
  if (tree) once($$('.tree-node', tree), tree, { x: 60, rotation: 2, stagger: 0.15 })
  const map = $('[data-map]')
  if (map) {
    once(map, map, { y: 80, rotation: -4 })
    once($$('.map-pin, .map-label', map), map, { scale: 0, transformOrigin: '50% 50%', stagger: 0.06, delay: 0.4, ease: 'back.out(2)' })
  }
  const ambition = $('[data-ambition]')
  if (ambition) {
    gsap
      .timeline({ scrollTrigger: { trigger: ambition, start: 'top 85%', end: 'center 50%', scrub: true } })
      .from('.ambition-paper', { rotation: -10, scale: 0.9, ease: 'none' }, 0)
      .from('.ambition-inner', { y: 60, rotation: 2, ease: 'none' }, 0)
  }
  const catalog = $('[data-catalog]')
  if (catalog) once($$('.course', catalog), catalog, { y: 70, rotation: (i: number) => (i % 2 ? 2 : -2), stagger: 0.1 })
  const steps = $('[data-steps]')
  if (steps) once($$('.step', steps), steps, { y: 50, stagger: 0.14 })
  const faqList = $('[data-faq]')
  if (faqList) once($$('.faq-item', faqList), faqList, { y: 30, stagger: 0.07 })
  const cal = $('[data-calendar]')
  if (cal) {
    once(cal, cal, { y: 60, rotation: 6 })
    once('.infos > div', '.infos', { x: 40, stagger: 0.08 })
  }
  for (const form of $$('[data-mailto-form]')) once(form, form, { y: 70, rotation: 1.5 })
  const cards = $('[data-contact-cards]')
  if (cards) once($$('.contact-link', cards), cards, { x: -40, stagger: 0.1 })
  const doc = $('.doc')
  if (doc) once($$('.doc > *:not(.doc-paper)', doc).slice(0, 4), doc, { y: 24, stagger: 0.08 })
  const paper = $('.doc-paper')
  if (paper) gsap.from(paper, { rotation: -30, scale: 0.6, autoAlpha: 0, duration: 1.4, ease: 'expo.out', delay: 0.2 })
}

/* ——— Démarrage ——— */
header()
checkout()
filters()
faq()
calendar()
mailtoForms()

const mm = gsap.matchMedia()
mm.add('(prefers-reduced-motion: no-preference)', () => {
  heroIntro()
  ribbon()
  revealTitles()
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) microInteractions()
})
mm.add('(prefers-reduced-motion: reduce)', () => {
  root.classList.remove('anim')
})
let hashFixed = false
mm.add(
  {
    wide: '(min-width: 901px) and (min-height: 601px)',
    motion: '(prefers-reduced-motion: no-preference)',
  },
  (ctx) => {
    const { wide, motion } = ctx.conditions as { wide: boolean; motion: boolean }
    if (!motion) return
    fontsReady().then(() => {
      ctx.add(() => {
        scrollScenes(wide)
        pageScenes()
      })
      ScrollTrigger.sort()
      ScrollTrigger.refresh()
      // Arrivée sur une ancre (#agenda, retour de paiement #reserver…) : les sections épinglées
      // ont allongé la page, on se recale sur la cible une fois les positions calculées.
      if (!hashFixed && location.hash.length > 1) {
        hashFixed = true
        const target = document.getElementById(decodeURIComponent(location.hash.slice(1)))
        if (target) target.scrollIntoView()
      }
    })
  },
)
