// Données de démonstration : 3 formations, comptes de test, parrainages et ateliers.
// Utilisées par le mode démo (aucun Supabase configuré) et reprises dans supabase/seed.sql.
import { SESSIONS } from '../../data/sessions'
import { DEFAULT_SETTINGS } from './logic'
import type { Formation, FullFormation, LessonContent, Profile, Settings } from './types'

const VIDEO = '/video/mjform-presentation-720.mp4'
const SLIDES = '/espace-demo/support-demo.pdf'

type SeedLesson = Omit<LessonContent, 'moduleId' | 'position' | 'status'> & { status?: LessonContent['status'] }
type SeedModule = { id: string; title: string; lessons: SeedLesson[] }

function build(
  f: Omit<Formation, 'modules' | 'status'> & { status?: Formation['status'] },
  modules: SeedModule[],
): FullFormation {
  return {
    ...f,
    status: f.status ?? 'published',
    modules: modules.map((m, mi) => ({
      id: m.id,
      formationId: f.id,
      title: m.title,
      position: mi,
      lessons: m.lessons.map((l, li) => ({ ...l, moduleId: m.id, position: li, status: l.status ?? 'published' })),
    })),
  }
}

const text = (id: string, title: string, durationMin: number, body: string, extra: Partial<SeedLesson> = {}): SeedLesson => ({
  id,
  title,
  kind: 'text',
  durationMin,
  body,
  videoUrl: null,
  slidesUrl: null,
  allowDownload: false,
  resources: [],
  ...extra,
})

export const SEED_FORMATIONS = [
  build(
    {
      id: 'f-initiation',
      slug: 'initiation-ia',
      title: 'Atelier d’initiation IA',
      subtitle: 'Les bons réflexes avec ChatGPT et Claude',
      description:
        'L’atelier de 3 heures en présentiel à Sète, puis tout ce qu’il faut pour continuer chez vous : les supports, les consignes prêtes à copier et des exercices sur vos vrais comptes.',
      level: 'Initiation',
      duration: '3 h',
      price: 49,
      benefits: [
        'Répondre à vos avis Google en quelques minutes',
        'Préparer un mois de publications en une matinée',
        'Rédiger devis et e-mails sans y passer la soirée',
      ],
      position: 0,
    },
    [
      {
        id: 'm-init-1',
        title: 'L’atelier',
        lessons: [
          text(
            'l-init-1',
            'Votre atelier en présentiel',
            180,
            `## Ce que vous avez fait pendant l’atelier

Trois heures, votre téléphone, vos vrais comptes. Cette leçon est validée d’office : vous l’avez suivie en présentiel.

- ChatGPT et Claude installés et réglés sur votre téléphone
- Vos premiers avis Google répondus
- Vos premières publications préparées

## La suite

Les leçons suivantes reprennent chaque point, à votre rythme. Comptez **15 minutes par leçon**.`,
            { completedByWorkshop: true },
          ),
        ],
      },
      {
        id: 'm-init-2',
        title: 'Les bons réflexes',
        lessons: [
          {
            ...text('l-init-2', 'L’IA pour votre commerce, en une minute', 1, `## À retenir

L’IA prépare, **vous validez**. Rien ne part sans votre relecture.

Regardez la vidéo, puis passez au support de l’atelier.`),
            kind: 'video',
            videoUrl: VIDEO,
          },
          {
            ...text('l-init-3', 'Le support de l’atelier', 10, `Le support complet de l’atelier, à feuilleter en plein écran.

Utilisez les **flèches du clavier** ou **faites glisser** sur téléphone. Vous pouvez le télécharger.`),
            kind: 'slides',
            slidesUrl: SLIDES,
            allowDownload: true,
          },
          text(
            'l-init-4',
            'Vos 10 consignes prêtes à copier',
            15,
            `## Comment s’en servir

Copiez une consigne, collez-la dans ChatGPT ou Claude, remplacez ce qui est entre crochets.

1. **Avis Google** : « Réponds à cet avis client à mon ton, chaleureux et bref : [avis]. »
2. **Publication** : « Écris une publication Instagram pour annoncer [nouveauté], 3 lignes, une question à la fin. »
3. **Devis** : « Transforme ces notes en devis clair : [notes]. »
4. **E-mail** : « Réponds poliment à ce client qui demande [demande]. »
5. **Horaires** : « Rédige le message d’horaires des fêtes pour ma fiche Google : [horaires]. »

La fiche complète est dans les ressources.`,
            { resources: [{ id: 'r-init-1', name: 'Fiche « 10 consignes »', url: SLIDES, size: '120 Ko' }] },
          ),
        ],
      },
      {
        id: 'm-init-3',
        title: 'Passer à l’action',
        lessons: [
          text(
            'l-init-5',
            'Répondre à tous vos avis en 10 minutes',
            15,
            `## La méthode

1. Ouvrez votre fiche Google, onglet **Avis**.
2. Copiez les avis sans réponse, un par un.
3. Demandez une réponse **à votre ton**, puis relisez.

## Les pièges

- Ne jamais publier sans relire
- Répondre aussi aux avis négatifs, calmement et sans se justifier`,
          ),
          text(
            'l-init-6',
            'Préparer un mois de publications',
            20,
            `## En une séance

Listez 4 sujets : un produit, une coulisse, un avis client, une info pratique.

Demandez 4 publications, une par semaine, puis programmez-les. **20 minutes par semaine suffisent ensuite.**`,
          ),
        ],
      },
    ],
  ),
  build(
    {
      id: 'f-claude',
      slug: 'maitriser-claude',
      title: 'Maîtriser Claude',
      subtitle: 'Projets, documents et consignes durables',
      description:
        'Configurez Claude une fois pour toutes avec vos tarifs, vos horaires et votre ton. Il répond ensuite comme quelqu’un qui connaît votre commerce.',
      level: 'Intermédiaire',
      duration: '3 h',
      price: 179,
      benefits: [
        'Un assistant qui connaît vos tarifs et vos produits',
        'Des réponses à votre ton, sans tout réexpliquer',
        'Une bibliothèque de demandes prêtes pour votre métier',
      ],
      position: 1,
    },
    [
      {
        id: 'm-claude-1',
        title: 'Prendre en main Claude',
        lessons: [
          text('l-claude-1', 'Claude ou ChatGPT : lequel pour quoi ?', 10, `## En bref

Les deux savent écrire. Claude excelle sur les **longs documents** et les **consignes durables**. Gardez celui que vous ouvrez le plus facilement.`),
          { ...text('l-claude-2', 'Vos premiers projets', 12, 'Créez un projet par usage : avis, publications, devis.'), kind: 'video', videoUrl: VIDEO },
        ],
      },
      {
        id: 'm-claude-2',
        title: 'Travailler avec vos documents',
        lessons: [
          text('l-claude-3', 'Donner vos tarifs, horaires et produits', 15, `## Les documents à préparer

- Votre carte ou vos tarifs
- Vos horaires, y compris exceptionnels
- Trois exemples de messages que vous aimez`),
          { ...text('l-claude-4', 'Le support : projets et consignes', 10, 'Le support complet, en plein écran.'), kind: 'slides', slidesUrl: SLIDES, allowDownload: false },
        ],
      },
      {
        id: 'm-claude-3',
        title: 'Vos consignes permanentes',
        lessons: [
          text('l-claude-5', 'Écrire des consignes à votre ton', 15, 'Décrivez votre ton en trois mots, avec un exemple de phrase.'),
          text('l-claude-6', 'Bibliothèque de demandes métier', 20, 'Vingt demandes classées par usage, à copier.'),
        ],
      },
    ],
  ),
  build(
    {
      id: 'f-agents',
      slug: 'agents-ia',
      title: 'Créer ses agents IA',
      subtitle: 'Un assistant qui répond à vos clients',
      description:
        'Construisez un agent nourri de vos informations, testez-le sur de vraies questions, puis branchez-le sur votre site ou votre messagerie.',
      level: 'Avancé',
      duration: '6 h',
      price: 349,
      benefits: [
        'Un agent qui répond aux questions fréquentes, même à 23 h',
        'Les réservations et demandes notées sans vous',
        'Testé sur les vraies questions de vos clients',
      ],
      position: 2,
    },
    [
      {
        id: 'm-agents-1',
        title: 'Comprendre les agents',
        lessons: [
          text('l-agents-1', 'Ce qu’un agent peut faire, et ne doit pas faire', 15, 'Un agent répond à partir de ce que vous lui donnez. Il ne doit jamais inventer un prix ni une disponibilité.'),
          { ...text('l-agents-2', 'Exemple : l’agent d’un restaurant', 8, 'Un agent en conditions réelles.'), kind: 'video', videoUrl: VIDEO },
        ],
      },
      {
        id: 'm-agents-2',
        title: 'Construire votre premier agent',
        lessons: [
          text('l-agents-3', 'Rassembler ses connaissances', 30, 'Horaires, tarifs, produits, questions fréquentes : un seul document clair.'),
          text('l-agents-4', 'Le tester sur 20 vraies questions', 40, 'Notez chaque réponse : juste, à corriger, à interdire.'),
        ],
      },
      {
        id: 'm-agents-3',
        title: 'Le brancher à votre commerce',
        lessons: [
          { ...text('l-agents-5', 'Le support : mise en ligne', 10, 'Les options de mise en ligne, pas à pas.'), kind: 'slides', slidesUrl: SLIDES, allowDownload: true },
          text('l-agents-6', 'Suivre et améliorer son agent', 20, 'Relisez les conversations chaque semaine pendant un mois.'),
        ],
      },
    ],
  ),
]

export type SeedUser = Profile & { password: string | null }

const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()

const person = (p: Partial<SeedUser> & Pick<SeedUser, 'id' | 'email' | 'firstName' | 'lastName' | 'referralCode'>): SeedUser => ({
  company: '',
  activity: '',
  phone: '',
  avatarUrl: null,
  notifyEmail: true,
  notifySms: false,
  role: 'client',
  referredBy: null,
  createdAt: at(30),
  password: null,
  ...p,
})

/** Comptes de test (mode démo uniquement) */
export const DEMO_LOGINS = {
  client: { email: 'client@demo.mjform.fr', password: 'demo1234' },
  admin: { email: 'admin@demo.mjform.fr', password: 'admin1234' },
}

export const SEED_USERS: SeedUser[] = [
  person({
    id: 'u-camille',
    email: DEMO_LOGINS.client.email,
    password: DEMO_LOGINS.client.password,
    firstName: 'Camille',
    lastName: 'Martin',
    company: 'Boulangerie du Port',
    activity: 'Boulangerie',
    phone: '06 00 00 00 00',
    referralCode: 'CAMILLE-7K2',
    createdAt: at(20),
  }),
  person({
    id: 'u-jeremy',
    email: DEMO_LOGINS.admin.email,
    password: DEMO_LOGINS.admin.password,
    firstName: 'Jérémy',
    lastName: 'Vatuone',
    company: 'MJ FORM',
    activity: 'Formateur',
    role: 'admin',
    referralCode: 'JEREMY-MJF',
  }),
  person({ id: 'u-matheis', email: 'matheis@demo.mjform.fr', password: 'admin1234', firstName: 'Matheis', lastName: 'MJ FORM', company: 'MJ FORM', activity: 'Formateur', role: 'admin', referralCode: 'MATHEIS-MJF' }),
  person({ id: 'u-lucas', email: 'lucas.b@demo.mjform.fr', firstName: 'Lucas', lastName: 'Bernard', company: 'Cave du Quai', activity: 'Caviste', referralCode: 'LUCAS-4PZ', referredBy: 'CAMILLE-7K2', createdAt: at(14) }),
  person({ id: 'u-sophie', email: 'sophie.m@demo.mjform.fr', firstName: 'Sophie', lastName: 'Moreau', company: 'Fleurs de Thau', activity: 'Fleuriste', referralCode: 'SOPHIE-9QW', referredBy: 'CAMILLE-7K2', createdAt: at(10) }),
  person({ id: 'u-nadia', email: 'nadia.r@demo.mjform.fr', firstName: 'Nadia', lastName: 'Roux', company: 'Institut Nadia', activity: 'Esthéticienne', referralCode: 'NADIA-3HM', referredBy: 'CAMILLE-7K2', createdAt: at(4) }),
]

export const SEED_SETTINGS: Settings = DEFAULT_SETTINGS

/** Ateliers repris du site (src/data/sessions.ts), avec leur lieu. */
export const SEED_WORKSHOPS = SESSIONS.map((s) => ({
  id: `w-${s.id}`,
  title: s.ateliers.length === 1 && s.ateliers[0] === 'fetes' ? 'Atelier spécial fêtes' : 'Atelier MJ FORM',
  startsAt: s.start,
  endsAt: s.end ?? null,
  location: 'Sète',
  capacity: s.capacity,
  bookingUrl: s.ateliers[0] === 'fetes' ? '/?pilote' : '/#reserver',
}))
