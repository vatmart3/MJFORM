import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Html, Lightformer, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { storyProgress, storyEnter } from '../../lib/store'
import { PhoneScreens } from './Screens'

/*
  Smartphone générique, sans aucune marque : bloc aux bords arrondis, cadre métal,
  caméra frontale en simple poinçon. L'écran est un vrai DOM (drei <Html transform>)
  pour garder un texte net et des animations CSS à ressort.
*/

const W = 0.78
const H = 1.62
const D = 0.085
const SCREEN_W = 0.724
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
    // Léger balancement d'une scène à l'autre, entrée en rotation depuis le bas
    let ry = reduced ? 0 : -0.16 * Math.cos(Math.PI * t) + pointer.current.x * 0.14
    let rx = reduced ? 0 : 0.06 + pointer.current.y * 0.06 + (1 - enter) * 0.55
    let y = reduced ? 0 : -(1 - enter) * 0.5 + Math.sin(state.clock.elapsedTime * 0.9) * 0.012
    let rz = reduced ? 0 : 0.03 * Math.sin(Math.PI * t)
    // Sortie : le téléphone s'éloigne un peu en fin de section
    const out = Math.max(0, (p - 0.94) / 0.06)
    const s = 1 - out * 0.06
    if (reduced) {
      ry = rx = rz = y = 0
    }
    const k = 6
    g.rotation.y = damp(g.rotation.y, ry, k, dt)
    g.rotation.x = damp(g.rotation.x, rx, k, dt)
    g.rotation.z = damp(g.rotation.z, rz, k, dt)
    g.position.y = damp(g.position.y, y, k, dt)
    g.scale.setScalar(damp(g.scale.x, s, k, dt))
  })

  const frame = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: '#b9b9be', metalness: 1, roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
    [],
  )
  const glass = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: '#050506', metalness: 0.1, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 }),
    [],
  )
  const back = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#2c2c2e', metalness: 0.3, roughness: 0.45, clearcoat: 0.8 }), [])

  return (
    <group ref={group}>
      {/* Cadre métal */}
      <RoundedBox args={[W, H, D]} radius={0.105} smoothness={8} material={frame} />
      {/* Dos */}
      <RoundedBox args={[W - 0.012, H - 0.012, 0.01]} radius={0.1} smoothness={6} position={[0, 0, -D / 2 - 0.001]} material={back} />
      {/* Verre avant */}
      <RoundedBox args={[W - 0.016, H - 0.016, 0.006]} radius={0.098} smoothness={6} position={[0, 0, D / 2 - 0.001]} material={glass} />
      {/* Boutons latéraux */}
      <mesh position={[W / 2 + 0.004, 0.32, 0]} material={frame}>
        <boxGeometry args={[0.012, 0.2, 0.03]} />
      </mesh>
      <mesh position={[-W / 2 - 0.004, 0.42, 0]} material={frame}>
        <boxGeometry args={[0.012, 0.11, 0.03]} />
      </mesh>
      <mesh position={[-W / 2 - 0.004, 0.27, 0]} material={frame}>
        <boxGeometry args={[0.012, 0.11, 0.03]} />
      </mesh>
      {/* Écran : DOM réel projeté en 3D */}
      <Html
        transform
        distanceFactor={DISTANCE_FACTOR}
        position={[0, 0, D / 2 + 0.0035]}
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
    const fill = size.width < 700 ? 0.86 : 0.8
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
          <Lightformer form="rect" intensity={2.4} position={[0, 2.5, 3]} scale={[6, 1.2, 1]} />
          <Lightformer form="rect" intensity={1.2} position={[-3, 0, 2]} rotation-y={Math.PI / 2} scale={[4, 2, 1]} />
          <Lightformer form="rect" intensity={1.2} position={[3, 0, 2]} rotation-y={-Math.PI / 2} scale={[4, 2, 1]} />
          <Lightformer form="circle" intensity={0.8} position={[0, -3, 1]} scale={2} />
        </Environment>
        <Phone reduced={reduced} onReady={onReady} portal={wrap} />
      </Canvas>
    </div>
  )
}
