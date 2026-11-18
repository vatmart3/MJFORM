import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { CONTACT, NEXT_WORKSHOP, OFFERS, AREA } from './src/site/content.ts'

const SITE_URL = 'https://mjform.fr'

/** Données structurées (SEO local) de l'accueil : organisme de formation + ateliers. */
function jsonLd(siteUrl: string): Plugin {
  const org = {
    '@type': ['LocalBusiness', 'EducationalOrganization'],
    '@id': `${siteUrl}/#mjform`,
    name: 'MJ FORM',
    description:
      'Ateliers et formations à l’intelligence artificielle pour les commerçants, artisans, indépendants et dirigeants de TPE/PME du Bassin de Thau. En présentiel à Sète, en petit groupe, ou en ligne.',
    url: siteUrl,
    telephone: CONTACT.tel,
    email: CONTACT.email,
    address: { '@type': 'PostalAddress', addressLocality: 'Sète', postalCode: '34200', addressRegion: 'Occitanie', addressCountry: 'FR' },
    geo: { '@type': 'GeoCoordinates', latitude: 43.4028, longitude: 3.6966 },
    areaServed: [...AREA, 'Bassin de Thau'].map((name) => ({ '@type': 'City', name })),
    parentOrganization: { '@type': 'Organization', name: 'MJ AGENCY', parentOrganization: { '@type': 'Organization', name: 'MJ LAB' } },
  }
  const courses = OFFERS.map((o) => ({
    '@type': 'Course',
    '@id': `${siteUrl}/#${o.id}`,
    name: `${o.title} — formation IA à Sète`,
    description: `${o.summary} ${o.topics.join(', ')}.`,
    inLanguage: 'fr',
    provider: { '@id': `${siteUrl}/#mjform` },
    ...(o.id === 'fetes'
      ? {
          offers: { '@type': 'Offer', price: 49, priceCurrency: 'EUR', category: 'Paid', availability: 'https://schema.org/InStock' },
          hasCourseInstance: {
            '@type': 'CourseInstance',
            courseMode: 'Onsite',
            startDate: NEXT_WORKSHOP.date,
            location: { '@type': 'Place', name: 'Sète', address: org.address },
          },
        }
      : {}),
  }))
  const data = { '@context': 'https://schema.org', '@graph': [org, ...courses] }
  return {
    name: 'mjform-jsonld',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        html = html.replaceAll('%SITE_URL%', siteUrl)
        if (ctx.filename !== resolve(import.meta.dirname, 'index.html')) return html
        return html.replace('</head>', `<script type="application/ld+json">${JSON.stringify(data)}</script>\n</head>`)
      },
    },
  }
}

/** Morceaux de page partagés : <!-- @include header --> → src/site/partials/header.html */
function partials(): Plugin {
  return {
    name: 'mjform-partials',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html.replace(/<!--\s*@include\s+([a-z-]+)\s*-->/g, (_m, name: string) =>
          readFileSync(resolve(import.meta.dirname, 'src/site/partials', `${name}.html`), 'utf8'),
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
    // Espace de test (mode démo) : ouvert partout tant que VITE_ESPACE_DEMO ne vaut pas 0
    define: { __ESPACE_DEMO__: JSON.stringify(process.env.VITE_ESPACE_DEMO !== '0' || process.env.VERCEL_ENV !== 'production') },
    plugins: [react(), partials(), jsonLd(siteUrl), devApi(), spaFallback()],
    build: {
      target: 'es2020',
      rollupOptions: {
        input: {
          main: resolve(import.meta.dirname, 'index.html'),
          apropos: resolve(import.meta.dirname, 'a-propos/index.html'),
          ateliers: resolve(import.meta.dirname, 'ateliers/index.html'),
          agenda: resolve(import.meta.dirname, 'agenda/index.html'),
          contact: resolve(import.meta.dirname, 'contact/index.html'),
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
