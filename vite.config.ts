import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { ATELIERS } from './src/data/ateliers.ts'
import { FAQ } from './src/data/faq.ts'
import { CONTACT, SITE_URL } from './src/config.ts'

function jsonLd(siteUrl: string): Plugin {
  const phone = '+33611718368'
  const email = CONTACT.email
  const org = {
    '@type': ['LocalBusiness', 'EducationalOrganization'],
    '@id': `${siteUrl}/#mjform`,
    name: 'MJ FORM',
    description:
      'Ateliers IA pour commerçants et entrepreneurs du Bassin de Thau : ChatGPT, Claude, avis Google, réseaux sociaux, devis et agents IA.',
    url: siteUrl,
    telephone: phone,
    email,
    priceRange: '49 € – 990 €',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '54 rue Marceau',
      addressLocality: 'Sète',
      postalCode: '34200',
      addressRegion: 'Occitanie',
      addressCountry: 'FR',
    },
    geo: { '@type': 'GeoCoordinates', latitude: 43.4028, longitude: 3.6966 },
    areaServed: ['Sète', 'Frontignan', 'Balaruc-les-Bains', 'Mèze', 'Marseillan', 'Bouzigues', 'Bassin de Thau'].map(
      (name) => ({ '@type': 'City', name }),
    ),
    parentOrganization: { '@type': 'Organization', name: 'MJ LAB' },
  }
  const courses = ATELIERS.map((a) => ({
    '@type': 'Course',
    '@id': `${siteUrl}/#${a.id}`,
    name: `${a.name} — atelier IA à Sète`,
    description: `${a.pitch} ${a.takeaways.join('. ')}.`,
    inLanguage: 'fr',
    provider: { '@id': `${siteUrl}/#mjform` },
    educationalLevel: a.level === 'n1' ? 'Débutant' : 'Intermédiaire',
    offers: {
      '@type': 'Offer',
      price: a.price,
      priceCurrency: 'EUR',
      category: 'Paid',
      url: `${siteUrl}/#reserver`,
      availability: 'https://schema.org/InStock',
    },
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'Onsite',
      courseWorkload: a.isoDuration,
      location: { '@type': 'Place', name: 'Sète', address: org.address },
    },
  }))
  const faq = {
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a.join(' ') },
    })),
  }
  const video = {
    '@type': 'VideoObject',
    name: 'MJ FORM — L’atelier IA pour les commerçants de Sète, en une minute',
    description:
      'Pour qui, comment ça se passe et ce que vous emportez : avis Google, publications, devis automatiques, en 3 heures avec votre téléphone lors d’un atelier IA MJ FORM à Sète.',
    thumbnailUrl: `${siteUrl}/video/mjform-presentation-poster.jpg`,
    contentUrl: `${siteUrl}/video/mjform-presentation-1080.mp4`,
    uploadDate: '2026-11-16',
    duration: 'PT53S',
    inLanguage: 'fr',
    publisher: { '@id': `${siteUrl}/#mjform` },
  }
  const data = { '@context': 'https://schema.org', '@graph': [org, ...courses, faq, video] }
  return {
    name: 'mjform-jsonld',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        html = html.replaceAll('%SITE_URL%', siteUrl)
        if (ctx.filename !== resolve(import.meta.dirname, 'index.html')) return html
        return html.replace(
          '</head>',
          `<script type="application/ld+json">${JSON.stringify(data)}</script>\n</head>`,
        )
      },
    },
  }
}

/**
 * En développement (npm run dev), sert les fonctions de api/ comme le fera Vercel en production.
 * Nécessite STRIPE_SECRET_KEY et les STRIPE_PRICE_* dans l'environnement (ou un fichier .env.local).
 */
function devApi(): Plugin {
  return {
    name: 'mjform-dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res, next) => {
        const name = (req.url ?? '').split('?')[0].replace(/^\//, '')
        // api/<nom>.ts ou api/<dossier>/<nom>.ts (ex. /api/espace/checkout)
        if (!/^(?:[a-z-]+\/)?[a-z-]+$/.test(name)) return next()
        try {
          const mod = await server.ssrLoadModule(`/api/${name}.ts`)
          const handler = mod[req.method ?? 'GET']
          if (typeof handler !== 'function') {
            res.statusCode = 405
            return res.end()
          }
          const chunks: Buffer[] = []
          for await (const c of req) chunks.push(c as Buffer)
          const url = `http://${req.headers.host}${req.originalUrl ?? req.url}`
          const request = new Request(url, {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: chunks.length ? Buffer.concat(chunks) : undefined,
          })
          const response: Response = await handler(request)
          res.statusCode = response.status
          response.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (e) {
          next(e)
        }
      })
    },
  }
}

/** En développement, /espace/… et /admin/… renvoient vers leur application (comme les réécritures Vercel). */
function spaFallback(): Plugin {
  const rewrite = (req: { url?: string }, _res: unknown, next: () => void) => {
    const path = (req.url ?? '').split('?')[0]
    const m = /^\/(espace|admin)(\/[^.]*)?$/.exec(path)
    if (m && path !== `/${m[1]}/`) req.url = `/${m[1]}/index.html`
    next()
  }
  return {
    name: 'mjform-spa-fallback',
    configureServer(server) {
      server.middlewares.use(rewrite)
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite)
    },
  }
}

export default defineConfig(() => {
  const siteUrl = SITE_URL
  return {
    plugins: [react(), jsonLd(siteUrl), devApi(), spaFallback()],
    build: {
      target: 'es2020',
      rollupOptions: {
        input: {
          main: resolve(import.meta.dirname, 'index.html'),
          mentions: resolve(import.meta.dirname, 'mentions-legales/index.html'),
          cgv: resolve(import.meta.dirname, 'cgv/index.html'),
          merci: resolve(import.meta.dirname, 'merci/index.html'),
          espace: resolve(import.meta.dirname, 'espace/index.html'),
          admin: resolve(import.meta.dirname, 'admin/index.html'),
        },
      },
    },
  }
})
