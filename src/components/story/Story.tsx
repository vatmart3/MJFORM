import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ScrollTrigger, prefersReducedMotion, scrollToY } from '../../lib/motion'
import { SCENES, sceneLocal, storyEnter, storyProgress, useActiveScene } from '../../lib/store'
import { BookLink } from '../ui'
import { PhoneScreens } from './Screens'
import './screens.css'
import './story.css'

const PhoneCanvas = lazy(() => import('./PhoneCanvas'))

/** Hauteur de scroll par scène (en hauteur d'écran) : assez long pour lire, voir et comprendre. */
const SCENE_VH = 200

const SHORT = ['Avis', 'Réseaux', 'Devis', 'Agent IA']

/** Barre de progression en 4 segments, remplis au fil du scroll (sans re-rendu React). */
function StoryProgress({ active, onPick }: { active: number; onPick: (i: number) => void }) {
  const bar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = bar.current
    if (!el) return
    const fills = Array.from(el.querySelectorAll<HTMLElement>('.seg-fill'))
    let raf = 0
    const apply = () => {
      raf = 0
      const p = storyProgress.get()
      fills.forEach((f, i) => f.style.setProperty('--f', sceneLocal(p, i).toFixed(4)))
    }
    const unsub = storyProgress.subscribe(() => {
      if (!raf) raf = requestAnimationFrame(apply)
    })
    apply()
    return () => {
      unsub()
      cancelAnimationFrame(raf)
    }
  }, [])
  return (
    <div className="story-progress" ref={bar} role="tablist" aria-label="Étapes de la démonstration">
      {COPY.map((c, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={active === i}
          aria-label={`${c.first} ${c.second}`}
          className={`seg${active === i ? ' on' : ''}`}
          onClick={() => onPick(i)}
        >
          <span className="seg-track">
            <span className="seg-fill" />
          </span>
          <span className="seg-label">
            <span className="seg-n">0{i + 1}</span> {SHORT[i]}
          </span>
        </button>
      ))}
    </div>
  )
}

const COPY = [
  {
    eyebrow: 'Atelier Google et avis',
    first: 'Vos avis.',
    second: 'Enfin répondus.',
    text: 'Douze avis en attente. Une réponse juste, à votre ton, pour chacun. Vous relisez, vous publiez.',
    atelier: 'google-avis',
  },
  {
    eyebrow: 'Atelier Réseaux sociaux',
    first: 'Vos réseaux.',
    second: 'En 20 minutes par semaine.',
    text: 'Un mois de publications préparé d’un coup. Textes, visuels, calendrier. Il ne reste qu’à valider.',
    atelier: 'reseaux',
  },
  {
    eyebrow: 'Atelier Zéro paperasse',
    first: 'Vos devis.',
    second: 'Sans le dimanche soir.',
    text: 'Le devis se rédige pendant que vous servez. Vous validez, il part. La relance aussi.',
    atelier: 'zero-paperasse',
  },
  {
    eyebrow: 'Niveau 2 · Créer son agent IA',
    first: 'Votre IA.',
    second: 'Rien qu’à vous.',
    text: 'Un assistant qui connaît vos horaires, vos tarifs, vos produits. Et qui répond à vos clients, même à 23 h.',
    atelier: 'agent-ia',
  },
]

/** Widgets en verre dépoli autour du téléphone. depth = intensité de la parallaxe. */
const WIDGETS: Array<Array<{ pos: string; depth: number; title: string; sub: string; icon: 'dot' | 'check' | 'spark' | 'clock' }>> = [
  [
    { pos: 'a', depth: 1.2, title: 'Réponse rédigée', sub: 'À votre ton, en quelques secondes', icon: 'spark' },
    { pos: 'b', depth: 0.7, title: 'Vous validez', sub: 'Rien ne part sans vous', icon: 'check' },
    { pos: 'c', depth: 1.6, title: 'Fiche Google', sub: 'Horaires et photos à jour', icon: 'dot' },
  ],
  [
    { pos: 'a', depth: 1.4, title: 'Programmé', sub: 'Mardi · 9 h', icon: 'clock' },
    { pos: 'b', depth: 0.8, title: 'Texte et visuel', sub: 'Préparés ensemble', icon: 'spark' },
    { pos: 'c', depth: 1.2, title: '20 min', sub: 'par semaine, pas plus', icon: 'dot' },
  ],
  [
    { pos: 'a', depth: 1.1, title: 'Devis prêt', sub: 'À partir de trois lignes dictées', icon: 'spark' },
    { pos: 'b', depth: 1.5, title: 'Automatique', sub: 'Envoi et relance à J+7', icon: 'check' },
    { pos: 'c', depth: 0.8, title: 'Dimanche soir', sub: 'Libre', icon: 'clock' },
  ],
  [
    { pos: 'a', depth: 1.3, title: 'Agent en ligne', sub: 'Jour et nuit', icon: 'dot' },
    { pos: 'b', depth: 0.9, title: 'Vos horaires, vos tarifs', sub: 'Il ne répond que ce qu’il sait', icon: 'check' },
    { pos: 'c', depth: 1.6, title: 'Réservation notée', sub: 'Dimanche · 12 h 30 · 4 couverts', icon: 'spark' },
  ],
]

function WidgetIcon({ kind }: { kind: 'dot' | 'check' | 'spark' | 'clock' }) {
  return (
    <span className="glass-ic" aria-hidden="true">
      <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {kind === 'check' ? <path d="M4.5 10.5l3.5 3.5 7.5-8" /> : null}
        {kind === 'spark' ? <path d="M10 2.5v4M10 13.5v4M2.5 10h4M13.5 10h4M5 5l2 2M13 13l2 2M15 5l-2 2M7 13l-2 2" /> : null}
        {kind === 'clock' ? (
          <>
            <circle cx="10" cy="10" r="7" />
            <path d="M10 6v4l2.5 2" />
          </>
        ) : null}
        {kind === 'dot' ? <circle cx="10" cy="10" r="3.5" fill="currentColor" stroke="none" /> : null}
      </svg>
    </span>
  )
}

function Widgets() {
  const active = useActiveScene()
  const layer = useRef<HTMLDivElement>(null)

  // Parallaxe 3D : profondeur liée au scroll + inclinaison au pointeur (sans re-rendu React)
  useEffect(() => {
    const el = layer.current
    if (!el || prefersReducedMotion()) return
    const items = Array.from(el.querySelectorAll<HTMLElement>('[data-depth]'))
    let px = 0
    let py = 0
    let raf = 0
    const apply = () => {
      raf = 0
      const p = storyProgress.get()
      items.forEach((it) => {
        const depth = Number(it.dataset.depth)
        const scene = Number(it.dataset.scene)
        const local = sceneLocal(p, scene)
        const y = (0.5 - local) * 90 * depth
        it.style.transform = `translate3d(${px * 14 * depth}px, ${y + py * 10 * depth}px, ${depth * 40}px)`
      })
      el.style.transform = `rotateY(${px * 6}deg) rotateX(${-py * 5}deg)`
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply)
    }
    const unsub = storyProgress.subscribe(schedule)
    const fine = window.matchMedia('(hover: hover)').matches
    const move = (e: PointerEvent) => {
      px = (e.clientX / window.innerWidth) * 2 - 1
      py = (e.clientY / window.innerHeight) * 2 - 1
      schedule()
    }
    if (fine) window.addEventListener('pointermove', move, { passive: true })
    apply()
    return () => {
      unsub()
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', move)
    }
  }, [])

  return (
    <div className="glass-layer" ref={layer} aria-hidden="true">
      {WIDGETS.map((group, s) =>
        group.map((w, i) => (
          <div key={`${s}-${i}`} className={`glass-slot pos-${w.pos}`} data-depth={w.depth} data-scene={s}>
            <div className={`glass${active === s ? ' on' : ''}`} style={{ ['--d' as string]: `${i * 90 + 120}ms` }}>
              <WidgetIcon kind={w.icon} />
              <span>
                <b>{w.title}</b>
                <em>{w.sub}</em>
              </span>
            </div>
          </div>
        )),
      )}
    </div>
  )
}

function SceneCopy({ i, active }: { i: number; active: boolean }) {
  const c = COPY[i]
  let k = 0
  const words = (text: string) =>
    text.split(' ').map((w, j, arr) => (
      <span key={j}>
        <span className="w">
          <span style={{ ['--i' as string]: k++ }}>{w}</span>
        </span>
        {j < arr.length - 1 ? ' ' : ''}
      </span>
    ))
  return (
    <div className={`scene-copy${active ? ' on' : ''}`} inert={!active}>
      <p className="eyebrow">{c.eyebrow}</p>
      <h2 className="title story-title">
        {words(c.first)} <br />
        <span className="second">{words(c.second)}</span>
      </h2>
      <p className="story-text">{c.text}</p>
      <BookLink atelierId={c.atelier}>Réserver cet atelier</BookLink>
    </div>
  )
}

function useWebGL() {
  const [ok, setOk] = useState<boolean | null>(null)
  useEffect(() => {
    try {
      const c = document.createElement('canvas')
      setOk(Boolean(c.getContext('webgl2') || c.getContext('webgl')))
    } catch {
      setOk(false)
    }
  }, [])
  return ok
}

export function Story() {
  const section = useRef<HTMLElement>(null)
  const active = useActiveScene()
  const webgl = useWebGL()
  const [near, setNear] = useState(false)
  const [canvasReady, setCanvasReady] = useState(false)
  const [reduced, setReduced] = useState(false)

  const cssScreen = useRef<HTMLDivElement>(null)

  useEffect(() => setReduced(prefersReducedMotion()), [])

  // Mise à l'échelle de l'écran 360 × 780 dans le téléphone CSS
  useEffect(() => {
    const el = cssScreen.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => el.style.setProperty('--s', String(e.contentRect.width / 360)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Progression scrubbée sur toute la hauteur de la section
  useEffect(() => {
    const el = section.current
    if (!el) return
    const main = ScrollTrigger.create({
      trigger: el,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => storyProgress.set(self.progress),
    })
    const enter = ScrollTrigger.create({
      trigger: el,
      start: 'top bottom',
      end: 'top top',
      onUpdate: (self) => storyEnter.set(self.progress),
    })
    storyProgress.set(main.progress)
    storyEnter.set(enter.progress)
    return () => {
      main.kill()
      enter.kill()
    }
  }, [])

  // Chargement de la 3D au premier geste de l'utilisateur (scroll, toucher, clavier) :
  // le premier affichage reste léger, le téléphone CSS assure la transition.
  useEffect(() => {
    const events = ['scroll', 'wheel', 'touchstart', 'pointerdown', 'keydown'] as const
    const go = () => {
      setNear(true)
      events.forEach((e) => window.removeEventListener(e, go))
    }
    events.forEach((e) => window.addEventListener(e, go, { passive: true, once: true }))
    if (window.scrollY > 0) go()
    return () => events.forEach((e) => window.removeEventListener(e, go))
  }, [])

  const goScene = (i: number) => {
    const el = section.current
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY
    const span = el.offsetHeight - window.innerHeight
    scrollToY(top + span * ((i + 0.75) / SCENES))
  }

  return (
    <section className="story" id="demo" ref={section} aria-label="Ce que vous ferez en atelier" style={{ height: `${SCENES * SCENE_VH + 100}svh` }}>
      <div className="story-sticky">
        <div className="story-grid wrap">
          <div className="story-copy">
            {COPY.map((_, i) => (
              <SceneCopy key={i} i={i} active={active === i} />
            ))}
          </div>
          <div className="story-stage">
            <div className="stage-3d">
              <Widgets />
              <div className={`css-phone${canvasReady ? ' hide' : ''}`} aria-hidden="true">
                <div className="css-phone-body">
                  <div className="css-phone-screen" ref={cssScreen}>
                    <PhoneScreens />
                  </div>
                </div>
              </div>
              {webgl && near ? (
                <Suspense fallback={null}>
                  <PhoneCanvas reduced={reduced} onReady={() => setCanvasReady(true)} />
                </Suspense>
              ) : null}
            </div>
          </div>
        </div>
        <div className="story-foot">
          <StoryProgress active={active} onPick={goScene} />
          <span className="story-note">Écrans de démonstration</span>
        </div>
      </div>
    </section>
  )
}
