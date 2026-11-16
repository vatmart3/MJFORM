import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Html, Lightformer, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { storyProgress, storyEnter } from '../../lib/store'
import { PhoneScreens } from './Screens'

/*
  Smartphone générique, sans aucune marque : bloc aux bords arrondis, cadre métal,
  caméra frontale en simple poinçon. L'écran est un vrai DOM (drei <Html transform>)
  pour garder un texte net et des animations CSS à ressort.
*/

const W = 0.78
const H = 1.64
const D = 0.078
const R = 0.118
const SCREEN_W = 0.744
const SCREEN_CSS_W = 360
// 1 px CSS = distanceFactor / 400 unités (cf. drei Html)
const DISTANCE_FACTOR = (SCREEN_W * 400) / SCREEN_CSS_W

const damp = THREE.MathUtils.damp

function Phone({
  reduced,
  onReady,
  portal,
}: {
  reduced: boolean
  onReady: () => void
  portal: RefObject<HTMLDivElement | null>
}) {
  const group = useRef<THREE.Group>(null)
  const pointer = useRef({ x: 0, y: 0 })
  const ready = useRef(false)

  useEffect(() => {
    if (reduced || !window.matchMedia('(hover: hover)').matches) return
    const move = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => window.removeEventListener('pointermove', move)
  }, [reduced])

  const glare = useRef<HTMLElement | null>(null)

  useFrame((state, dt) => {
    const g = group.current
    if (!g) return
    if (!ready.current) {
      ready.current = true
      onReady()
    }
    const p = storyProgress.get()
    const enter = storyEnter.get()
    const t = p * 4
    // Le téléphone reste de face pendant chaque scène et ne pivote qu'au passage
    // d'une scène à l'autre : on lit l'écran, puis il se tourne pour changer d'écran.
    const n = Math.round(t)
    let w = Math.max(0, 1 - Math.abs(t - n) / 0.22)
    w = w * w * (3 - 2 * w)
    const side = n % 2 === 0 ? -1 : 1
    const intro = (1 - enter) * (1 - enter)
    let ry = side * 0.3 * w + pointer.current.x * 0.12 - intro * 0.9
    let rx = 0.04 + pointer.current.y * 0.05 + (1 - enter) * 0.35
    let rz = side * 0.02 * w
    let y = -(1 - enter) * 0.45 + Math.sin(state.clock.elapsedTime * 0.8) * 0.01
    let s = 1 - 0.035 * w
    if (reduced) {
      ry = rx = rz = y = 0
      s = 1
    }
    // Amortissement doux : mouvement fluide, sans à-coups même si le scroll est rapide
    g.rotation.y = damp(g.rotation.y, ry, 3.2, dt)
    g.rotation.x = damp(g.rotation.x, rx, 3.2, dt)
    g.rotation.z = damp(g.rotation.z, rz, 3.2, dt)
    g.position.y = damp(g.position.y, y, 3.6, dt)
    g.scale.setScalar(damp(g.scale.x, s, 3.6, dt))

    // Reflet de l'écran qui glisse avec la rotation
    glare.current ??= portal.current?.querySelector<HTMLElement>('.ps-glare') ?? null
    if (glare.current) {
      glare.current.style.transform = `translate3d(${(-g.rotation.y * 120).toFixed(1)}px, ${(g.rotation.x * 80).toFixed(1)}px, 0)`
    }
  })

  const frame = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#c9c9ce',
        metalness: 1,
        roughness: 0.22,
        clearcoat: 1,
        clearcoatRoughness: 0.12,
      }),
    [],
  )
  const glass = useMemo(() => new THREE.MeshStandardMaterial({ color: '#050506', metalness: 0, roughness: 0.18 }), [])
  // Face avant plate aux coins arrondis : la bordure noire autour de l'écran
  const frontShape = useMemo(() => {
    const w = W - 0.012
    const h = H - 0.012
    const r = R - 0.006
    const x = -w / 2
    const y = -h / 2
    const shape = new THREE.Shape()
    shape.moveTo(x + r, y)
    shape.lineTo(x + w - r, y)
    shape.quadraticCurveTo(x + w, y, x + w, y + r)
    shape.lineTo(x + w, y + h - r)
    shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    shape.lineTo(x + r, y + h)
    shape.quadraticCurveTo(x, y + h, x, y + h - r)
    shape.lineTo(x, y + r)
    shape.quadraticCurveTo(x, y, x + r, y)
    return new THREE.ShapeGeometry(shape, 24)
  }, [])
  const back = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: '#d6d6db', metalness: 0.2, roughness: 0.55, clearcoat: 0.6, clearcoatRoughness: 0.4 }),
    [],
  )
  const lens = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#0a0a0c', metalness: 0.4, roughness: 0.1, clearcoat: 1 }), [])

  return (
    <group ref={group}>
      {/* Cadre métal aux bords arrondis */}
      <RoundedBox args={[W, H, D]} radius={R} smoothness={10} material={frame} />
      {/* Dos mat */}
      <RoundedBox args={[W - 0.01, H - 0.01, 0.008]} radius={R - 0.004} smoothness={8} position={[0, 0, -D / 2 - 0.0005]} material={back} />
      {/* Module photo générique au dos (deux objectifs, aucun logo) */}
      <group position={[-W / 2 + 0.17, H / 2 - 0.17, -D / 2 - 0.006]}>
        <RoundedBox args={[0.24, 0.24, 0.012]} radius={0.06} smoothness={6} material={back} />
        <mesh position={[0, 0.05, -0.008]} rotation-x={Math.PI / 2} material={lens}>
          <cylinderGeometry args={[0.042, 0.042, 0.012, 32]} />
        </mesh>
        <mesh position={[0, -0.05, -0.008]} rotation-x={Math.PI / 2} material={lens}>
          <cylinderGeometry args={[0.042, 0.042, 0.012, 32]} />
        </mesh>
      </group>
      {/* Verre avant, bordures fines */}
      <mesh geometry={frontShape} material={glass} position={[0, 0, D / 2 + 0.0012]} />
      {/* Boutons latéraux */}
      <RoundedBox args={[0.014, 0.2, 0.026]} radius={0.006} position={[W / 2 + 0.003, 0.3, 0]} material={frame} />
      <RoundedBox args={[0.014, 0.11, 0.026]} radius={0.006} position={[-W / 2 - 0.003, 0.42, 0]} material={frame} />
      <RoundedBox args={[0.014, 0.11, 0.026]} radius={0.006} position={[-W / 2 - 0.003, 0.27, 0]} material={frame} />
      {/* Écran : DOM réel projeté en 3D */}
      <Html
        transform
        distanceFactor={DISTANCE_FACTOR}
        position={[0, 0, D / 2 + 0.003]}
        pointerEvents="none"
        portal={portal as RefObject<HTMLElement>}
        zIndexRange={[5, 0]}
        className="phone-html"
      >
        <PhoneScreens />
      </Html>
    </group>
  )
}

/** Recadre la caméra pour que le téléphone occupe ~80 % de la hauteur disponible. */
function Rig() {
  const { camera, size } = useThree()
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    const fov = THREE.MathUtils.degToRad(cam.fov)
    const fill = size.width < 700 ? 0.88 : 0.76
    const byH = H / fill / (2 * Math.tan(fov / 2))
    const aspect = size.width / size.height
    const byW = W / 0.62 / (2 * Math.tan(fov / 2) * aspect)
    cam.position.set(0, 0, Math.max(byH, byW))
    cam.updateProjectionMatrix()
  }, [camera, size])
  return null
}

export default function PhoneCanvas({ reduced, onReady }: { reduced: boolean; onReady: () => void }) {
  const wrap = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)

  // Le rendu s'arrête dès que la section n'est plus à l'écran
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: '10%' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={wrap} className="phone-canvas">
      <Canvas
        frameloop={visible ? 'always' : 'never'}
        dpr={[1, 2]}
        camera={{ fov: 28, position: [0, 0, 4], near: 0.1, far: 20 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        aria-hidden="true"
      >
        <Rig />
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 3, 4]} intensity={1.2} />
        <Environment resolution={128} frames={1}>
          <Lightformer form="rect" intensity={2.6} position={[0, 2.5, 3]} scale={[6, 1.2, 1]} />
          <Lightformer form="rect" intensity={1.6} position={[0, 0, -3]} rotation-y={Math.PI} scale={[6, 4, 1]} />
          <Lightformer form="rect" intensity={1.2} position={[-3, 0, 2]} rotation-y={Math.PI / 2} scale={[4, 2, 1]} />
          <Lightformer form="rect" intensity={1.2} position={[3, 0, 2]} rotation-y={-Math.PI / 2} scale={[4, 2, 1]} />
          <Lightformer form="circle" intensity={0.8} position={[0, -3, 1]} scale={2} />
        </Environment>
        <Phone reduced={reduced} onReady={onReady} portal={wrap} />
        <ContactShadows position={[0, -H / 2 - 0.1, 0]} opacity={0.32} scale={2.6} blur={2.6} far={1.4} resolution={256} color="#1d1d1f" />
      </Canvas>
    </div>
  )
}
