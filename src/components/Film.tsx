import { useRef, useState } from 'react'
import { Eyebrow, SectionCta, SplitTitle } from './ui'

/**
 * Vidéo de présentation (30 s, avec son).
 * Rien n'est téléchargé avant le clic (preload="none") : la page reste légère pour les visiteurs
 * arrivés par le QR code. Version 720p sur mobile, 1080p sur ordinateur.
 */
export function Film() {
  const video = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)

  const play = () => {
    const v = video.current
    if (!v) return
    setPlaying(true)
    v.play().catch(() => setPlaying(false))
  }

  const reset = () => {
    const v = video.current
    setPlaying(false)
    if (v) v.load() // revient à l'image d'aperçu
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
            preload="none"
            playsInline
            controls={playing}
            poster="/video/mjform-atelier-poster.webp"
            onEnded={reset}
            aria-label="Vidéo de présentation des ateliers IA MJ FORM à Sète"
          >
            <source src="/video/mjform-atelier-720.mp4" type="video/mp4" media="(max-width: 900px)" />
            <source src="/video/mjform-atelier-1080.mp4" type="video/mp4" />
          </video>
          {!playing ? (
            <button type="button" className="film-play" onClick={play} aria-label="Lire la vidéo de présentation, 30 secondes, avec le son">
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
          ) : null}
        </div>
        <SectionCta secondary={{ href: '#ateliers', label: 'Voir les ateliers' }} />
      </div>
    </section>
  )
}
