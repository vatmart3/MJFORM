import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '../lib/motion'
import { Eyebrow, SectionCta, SplitTitle } from './ui'

/**
 * Vidéo de présentation (30 s), lue automatiquement sans le son et en boucle
 * dès qu'elle est visible, mise en pause hors de l'écran.
 * Rien n'est téléchargé tant qu'elle n'approche pas de l'écran (preload="none").
 * Version 720p sur mobile, 1080p sur ordinateur.
 * Avec « réduire les animations » activé, elle ne démarre pas seule : un bouton la lance.
 */
export function Film() {
  const video = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(true)
  const [manual, setManual] = useState(false)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const v = video.current
    if (!v) return
    v.muted = true
    if (prefersReducedMotion()) {
      setManual(true)
      return
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          v.play()
            .then(() => setStarted(true))
            .catch(() => setManual(true)) // lecture automatique bloquée (mode économie d'énergie…)
        } else {
          v.pause()
        }
      },
      { threshold: 0.35 },
    )
    io.observe(v)
    return () => io.disconnect()
  }, [])

  const playManually = () => {
    const v = video.current
    if (!v) return
    v.play().then(() => {
      setStarted(true)
      setManual(false)
    })
  }

  const toggleSound = () => {
    const v = video.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
    if (!v.muted && v.paused) v.play()
  }

  return (
    <section className="film" id="video" aria-labelledby="film-title">
      <div className="wrap">
        <div className="film-head">
          <Eyebrow>En 30 secondes</Eyebrow>
          <SplitTitle as="h2" className="title-sm" first="L’atelier." second="En 30 secondes." id="film-title" />
        </div>
        <div className="film-frame" data-reveal="">
          <video
            ref={video}
            muted
            loop
            playsInline
            preload="none"
            poster="/video/mjform-atelier-poster.webp"
            aria-label="Vidéo de présentation des ateliers IA MJ FORM à Sète"
          >
            <source src="/video/mjform-atelier-720.mp4" type="video/mp4" media="(max-width: 900px)" />
            <source src="/video/mjform-atelier-1080.mp4" type="video/mp4" />
          </video>
          {manual && !started ? (
            <button type="button" className="film-play" onClick={playManually} aria-label="Lire la vidéo de présentation, 30 secondes">
              <span className="film-pill">
                <span className="film-ic" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="14" height="14">
                    <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
                  </svg>
                </span>
                Voir la vidéo
                <span className="film-dur">0:30</span>
              </span>
            </button>
          ) : (
            <button
              type="button"
              className="film-sound"
              onClick={toggleSound}
              aria-pressed={!muted}
              aria-label={muted ? 'Activer le son de la vidéo' : 'Couper le son de la vidéo'}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
                {muted ? <path d="M16 9.5l5 5M21 9.5l-5 5" /> : <path d="M16 9a4.5 4.5 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />}
              </svg>
              {muted ? 'Activer le son' : 'Couper le son'}
            </button>
          )}
        </div>
        <SectionCta secondary={{ href: '#ateliers', label: 'Voir les ateliers' }} />
      </div>
    </section>
  )
}
