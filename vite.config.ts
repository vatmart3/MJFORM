import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { ATELIERS } from './src/data/ateliers.ts'
import { FAQ } from './src/data/faq.ts'

function jsonLd(siteUrl: string, phone: string, email: string): Plugin {
  const org = {
    '@type': ['LocalBusiness', 'EducationalOrganization'],
    '@id': `${siteUrl}/#mjform`,
    name: 'MJ FORM',
    description:
      'Ateliers IA pour commerçants et entrepreneurs du Bassin de Thau : ChatGPT, Claude, avis Google, réseaux sociaux, devis et agents IA.',
    url: siteUrl,
    ...(phone ? { telephone: phone } : {}),
    ...(email ? { email } : {}),
    priceRange: '129 € – 990 €',
    address: {
      '@type': 'PostalAddress',
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
  const data = { '@context': 'https://schema.org', '@graph': [org, ...courses, faq] }
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const siteUrl = (env.VITE_SITE_URL || 'https://mjform.fr').replace(/\/$/, '')
  return {
    plugins: [react(), jsonLd(siteUrl, env.VITE_CONTACT_PHONE || '', env.VITE_CONTACT_EMAIL || '')],
    build: {
      target: 'es2020',
      rollupOptions: {
        input: {
          main: resolve(import.meta.dirname, 'index.html'),
          mentions: resolve(import.meta.dirname, 'mentions-legales/index.html'),
          cgv: resolve(import.meta.dirname, 'cgv/index.html'),
          merci: resolve(import.meta.dirname, 'merci/index.html'),
        },
      },
    },
  }
})
