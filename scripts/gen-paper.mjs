// Génère les morceaux de papier déchiré du collage (public/paper/*.svg).
// Bords irréguliers déterministes (graine fixe), tranche blanche fibreuse et grain de papier.
//   node scripts/gen-paper.mjs
import { mkdirSync, writeFileSync } from 'node:fs'

const COLORS = {
  mint: '#9bd8a9',
  marigold: '#fde99b',
  periwinkle: '#b8caf5',
  sky: '#cfe9f6',
  white: '#fffdf9',
  papaya: '#ff4500',
}

function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** Contour déchiré d'un rectangle : petits points irréguliers + quelques déchirures plus franches. */
function tornPath(w, h, seed, rough, inset = 0) {
  const r = rng(seed)
  const pts = []
  const edge = (x0, y0, x1, y1, nx, ny) => {
    const len = Math.hypot(x1 - x0, y1 - y0)
    const n = Math.max(4, Math.round(len / (5 + r() * 4)))
    for (let i = 0; i < n; i++) {
      const t = i / n
      let d = (r() - 0.5) * rough + inset
      if (r() < 0.06) d += rough * (0.8 + r()) // déchirure plus marquée
      pts.push([x0 + (x1 - x0) * t + nx * d, y0 + (y1 - y0) * t + ny * d])
    }
  }
  const m = rough
  edge(m, m, w - m, m, 0, 1)
  edge(w - m, m, w - m, h - m, -1, 0)
  edge(w - m, h - m, m, h - m, 0, -1)
  edge(m, h - m, m, m, 1, 0)
  return 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L') + 'Z'
}

function paper(name, w, h, color, seed, { rough = 7, core = true } = {}) {
  const outer = tornPath(w, h, seed, rough)
  const inner = tornPath(w, h, seed + 7, rough * 0.9, 2.2)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="none">
<defs>
<filter id="grain" x="0" y="0" width="100%" height="100%">
<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="${seed % 97}" stitchTiles="stitch" result="n"/>
<feColorMatrix in="n" type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.22  0 0 0 0 0.18  0 0 0 0.09 0" result="g"/>
<feComposite in="g" in2="SourceGraphic" operator="in"/>
</filter>
</defs>
${core ? `<path d="${outer}" fill="${COLORS.white}"/>` : ''}
<path d="${core ? inner : outer}" fill="${COLORS[color]}"/>
<path d="${core ? inner : outer}" fill="#000" filter="url(#grain)"/>
</svg>`
  writeFileSync(`public/paper/${name}.svg`, svg)
}

mkdirSync('public/paper', { recursive: true })
paper('mint-a', 520, 380, 'mint', 11)
paper('mint-b', 300, 420, 'mint', 23)
paper('marigold-a', 460, 340, 'marigold', 37)
paper('marigold-b', 260, 260, 'marigold', 41)
paper('periwinkle-a', 420, 300, 'periwinkle', 53)
paper('periwinkle-b', 280, 380, 'periwinkle', 67)
paper('sky-a', 480, 320, 'sky', 71)
paper('white-a', 380, 460, 'white', 83, { core: false, rough: 6 })
paper('white-b', 520, 300, 'white', 89, { core: false, rough: 6 })
paper('strip-mint', 640, 90, 'mint', 97, { rough: 6 })
paper('strip-marigold', 560, 80, 'marigold', 101, { rough: 6 })
console.log('Papiers générés dans public/paper/')
