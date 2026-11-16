// Lecteur de diaporama PDF : aperçu, plein écran, clavier (flèches, Échap), glisser au doigt,
// téléchargement si l'admin l'autorise. pdf.js est chargé à la demande.
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Download, Maximize2, X } from 'lucide-react'
import type { PDFDocumentProxy } from 'pdfjs-dist'

let pdfjs: Promise<typeof import('pdfjs-dist')> | null = null
function loadPdfjs() {
  pdfjs ??= Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]).then(([lib, worker]) => {
    lib.GlobalWorkerOptions.workerSrc = worker.default
    return lib
  })
  return pdfjs
}

function usePdf(url: string) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let alive = true
    let task: { destroy: () => Promise<void> } | null = null
    loadPdfjs()
      .then((lib) => {
        const t = lib.getDocument({ url })
        task = t
        return t.promise
      })
      .then((d) => {
        if (alive) setDoc(d)
      })
      .catch(() => alive && setError(true))
    return () => {
      alive = false
      task?.destroy()
    }
  }, [url])
  return { doc, error }
}

/** Dessine une page dans un canvas à la largeur du conteneur (net sur écran Retina). */
function PageCanvas({ doc, page, maxHeight }: { doc: PDFDocumentProxy; page: number; maxHeight?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useEffect(() => {
    if (!width || !canvas.current) return
    let cancelled = false
    let task: { cancel: () => void } | null = null
    doc.getPage(page).then((p) => {
      if (cancelled || !canvas.current) return
      const base = p.getViewport({ scale: 1 })
      let scale = width / base.width
      if (maxHeight && base.height * scale > maxHeight) scale = maxHeight / base.height
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const vp = p.getViewport({ scale: scale * dpr })
      const c = canvas.current
      c.width = Math.floor(vp.width)
      c.height = Math.floor(vp.height)
      c.style.width = `${Math.floor(vp.width / dpr)}px`
      c.style.height = `${Math.floor(vp.height / dpr)}px`
      const render = p.render({ canvas: c, canvasContext: c.getContext('2d')!, viewport: vp })
      task = render
      render.promise.catch(() => {})
    })
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [doc, page, width, maxHeight])
  return (
    <div ref={wrap} className="pdf-page">
      <canvas ref={canvas} role="img" aria-label={`Diapositive ${page}`} />
    </div>
  )
}

export function Slides({ url, allowDownload, title }: { url: string; allowDownload: boolean; title: string }) {
  const { doc, error } = usePdf(url)
  const [page, setPage] = useState(1)
  const [full, setFull] = useState(false)
  const total = doc?.numPages ?? 0
  const go = useCallback((d: number) => setPage((p) => Math.max(1, Math.min(total || 1, p + d))), [total])

  useEffect(() => {
    if (!full) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        go(1)
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        go(-1)
      } else if (e.key === 'Escape') setFull(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [full, go])

  // Glisser au doigt
  const start = useRef<number | null>(null)
  const swipe = {
    onPointerDown: (e: React.PointerEvent) => (start.current = e.clientX),
    onPointerUp: (e: React.PointerEvent) => {
      if (start.current == null) return
      const dx = e.clientX - start.current
      if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
      start.current = null
    },
  }

  if (error) return <p className="muted">Le diaporama n’a pas pu être chargé.</p>
  if (!doc) return <div className="skel" style={{ aspectRatio: '16 / 9', borderRadius: 16 }} aria-label="Chargement du diaporama" />

  const controls = (dark: boolean) => (
    <div className={`slides-controls${dark ? ' dark' : ''}`}>
      <button type="button" className="icon-btn" onClick={() => go(-1)} disabled={page <= 1} aria-label="Diapositive précédente">
        <ChevronLeft />
      </button>
      <span className="small" aria-live="polite">
        {page} / {total}
      </span>
      <button type="button" className="icon-btn" onClick={() => go(1)} disabled={page >= total} aria-label="Diapositive suivante">
        <ChevronRight />
      </button>
      <span style={{ flex: 1 }} />
      {allowDownload ? (
        <a className="icon-btn" href={url} download aria-label="Télécharger le diaporama">
          <Download />
        </a>
      ) : null}
      {dark ? (
        <button type="button" className="icon-btn" onClick={() => setFull(false)} aria-label="Quitter le plein écran">
          <X />
        </button>
      ) : (
        <button type="button" className="icon-btn" onClick={() => setFull(true)} aria-label="Afficher en plein écran">
          <Maximize2 />
        </button>
      )}
    </div>
  )

  return (
    <div className="slides">
      <div className="slides-stage" {...swipe} onDoubleClick={() => setFull(true)}>
        <PageCanvas doc={doc} page={page} />
      </div>
      {controls(false)}
      {full
        ? createPortal(
            <div className="slides-full" role="dialog" aria-modal="true" aria-label={`${title} en plein écran`} {...swipe}>
              <div className="slides-full-stage">
                <PageCanvas doc={doc} page={page} maxHeight={window.innerHeight - 96} />
              </div>
              {controls(true)}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
