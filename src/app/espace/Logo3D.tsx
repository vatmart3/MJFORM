// Signature 3D du tableau de bord : un « MJ. » en volume, en CSS 3D (sans moteur 3D).
// Réagit légèrement à la souris, ou à l'inclinaison du téléphone quand le navigateur la fournit.
// Statique si l'utilisateur réduit les animations ou si l'appareil est modeste.
import { useEffect, useRef, useState } from 'react'

const LAYERS = 12

export default function Logo3D() {
  const stage = useRef<HTMLDivElement>(null)
  const [animated] = useState(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const weak = (navigator.hardwareConcurrency ?? 4) <= 2
    return !reduce && !weak
  })

  useEffect(() => {
    const el = stage.current
    if (!el || !animated) return
    let tx = -14
    let ty = 10
    let x = tx
    let y = ty
    let raf = 0
    const loop = () => {
      x += (tx - x) * 0.08
      y += (ty - y) * 0.08
      el.style.setProperty('--ry', `${x.toFixed(2)}deg`)
      el.style.setProperty('--rx', `${y.toFixed(2)}deg`)
      if (Math.abs(tx - x) > 0.05 || Math.abs(ty - y) > 0.05) raf = requestAnimationFrame(loop)
      else raf = 0
    }
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(loop)
    }
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const cx = (e.clientX - (r.left + r.width / 2)) / window.innerWidth
      const cy = (e.clientY - (r.top + r.height / 2)) / window.innerHeight
      tx = -14 + cx * 36
      ty = 10 - cy * 24
      kick()
    }
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return
      tx = -14 + Math.max(-20, Math.min(20, e.gamma)) * 0.8
      ty = 10 + Math.max(-20, Math.min(20, e.beta - 45)) * 0.5
      kick()
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('deviceorientation', onTilt, { passive: true })
    kick()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('deviceorientation', onTilt)
    }
  }, [animated])

  return (
    <div className="logo3d" ref={stage} aria-hidden="true">
      <div className="logo3d-obj">
        {Array.from({ length: LAYERS }).map((_, i) => (
          <span key={i} className="logo3d-layer" style={{ ['--i' as string]: i, ['--n' as string]: LAYERS }}>
            MJ<b>.</b>
          </span>
        ))}
      </div>
      <span className="logo3d-shadow" />
    </div>
  )
}
