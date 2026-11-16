import { useActiveScene, useSceneStep } from '../../lib/store'

/*
  Écrans de démonstration affichés dans le téléphone (360 × 780 px CSS).
  Commerce fictif, contenus illustratifs : ce ne sont pas des avis réels sur MJ FORM.
*/

const REVIEWS: Array<{ i: string; s: number; t: string; r: string; d: string }> = [
  { i: 'A', s: 5, d: 'il y a 2 j', t: 'Les moules étaient parfaites, service rapide.', r: 'Merci ! Elles arrivent de l’étang de Thau le matin même. Au plaisir.' },
  { i: 'L', s: 3, d: 'il y a 3 j', t: 'Très bon, un peu d’attente le samedi.', r: 'Merci pour votre retour. Le samedi, réservez : on vous garde la table.' },
  { i: 'K', s: 5, d: 'il y a 4 j', t: 'Terrasse au top, on reviendra.', r: 'Avec plaisir ! La terrasse vous attend.' },
  { i: 'M', s: 3, d: 'il y a 5 j', t: 'Bon, mais la musique était forte.', r: 'Merci de nous l’avoir dit. Le son est plus bas en soirée désormais.' },
  { i: 'J', s: 5, d: 'il y a 1 sem.', t: 'Meilleure tielle de Sète.', r: 'Rien que ça ! Merci, on transmet en cuisine.' },
  { i: 'S', s: 5, d: 'il y a 1 sem.', t: 'Personnel souriant, prix corrects.', r: 'Merci, toute l’équipe sera ravie de vous lire.' },
  { i: 'R', s: 4, d: 'il y a 1 sem.', t: 'Bon rapport qualité-prix.', r: 'Merci ! À très vite sur le quai.' },
  { i: 'C', s: 5, d: 'il y a 2 sem.', t: 'Parfait pour un anniversaire.', r: 'Merci d’avoir fêté ça chez nous !' },
  { i: 'N', s: 5, d: 'il y a 2 sem.', t: 'Le poisson du jour, une merveille.', r: 'Merci ! Le menu change chaque matin, selon la pêche.' },
  { i: 'B', s: 2, d: 'il y a 2 sem.', t: 'Plat arrivé tiède.', r: 'Toutes nos excuses. Revenez nous voir : le café sera pour nous.' },
  { i: 'E', s: 5, d: 'il y a 3 sem.', t: 'Accueil chaleureux, même tard.', r: 'Merci, on aime finir la soirée avec vous.' },
  { i: 'P', s: 5, d: 'il y a 3 sem.', t: 'On recommande les yeux fermés.', r: 'Merci pour votre confiance !' },
]

const CARD_H = 132

function StatusBar({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`ps-status${dark ? ' dark' : ''}`} aria-hidden="true">
      <span>8:02</span>
      <span className="ps-cam" />
      <span className="ps-ind">
        <i />
        <i />
        <i />
        <b />
      </span>
    </div>
  )
}

function Stars({ n }: { n: number }) {
  return (
    <span className="ps-stars" aria-label={`${n} étoiles sur 5`}>
      {'★★★★★'.slice(0, n)}
      <span className="off">{'★★★★★'.slice(n)}</span>
    </span>
  )
}

function ReviewsScreen() {
  const answered = useSceneStep(0, REVIEWS.length)
  const pending = REVIEWS.length - answered
  const shift = Math.max(0, answered - 2) * CARD_H
  return (
    <div className="ps-screen ps-reviews">
      <StatusBar />
      <div className="ps-appbar">
        <div>
          <div className="ps-kicker">Fiche Google</div>
          <div className="ps-title">Avis</div>
        </div>
        <span className={`ps-pill${pending === 0 ? ' ok' : ''}`}>
          {pending === 0 ? 'Tout est répondu ✓' : `${pending} sans réponse`}
        </span>
      </div>
      <div className="ps-viewport">
        <div className="ps-list" style={{ transform: `translate3d(0, ${-shift}px, 0)` }}>
          {REVIEWS.map((r, i) => {
            const done = i < answered
            return (
              <div key={i} className={`ps-review${done ? ' done' : ''}`}>
                <div className="ps-rhead">
                  <span className="ps-avatar">{r.i}</span>
                  <span>
                    <Stars n={r.s} />
                    <span className="ps-date">{r.d}</span>
                  </span>
                </div>
                <p className="ps-rtext">{r.t}</p>
                <div className="ps-reply">
                  <span className="ps-wait">En attente de réponse</span>
                  <span className="ps-answer">
                    <b>Réponse du propriétaire</b>
                    {r.r}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const POSTS: Array<{ k: 'dark' | 'light' | 'blue' | 'gray'; t: string; s?: string }> = [
  { k: 'dark', t: 'Arrivage', s: 'du jour' },
  { k: 'light', t: 'Le plat', s: 'de la semaine' },
  { k: 'gray', t: 'Coulisses', s: '5 h du matin' },
  { k: 'blue', t: 'Ouvert', s: 'dimanche midi' },
  { k: 'light', t: '« Merci ! »', s: 'avis client' },
  { k: 'dark', t: 'L’équipe', s: 'se présente' },
  { k: 'gray', t: 'Recette', s: 'la tielle' },
  { k: 'dark', t: 'Ce soir', s: 'concert' },
  { k: 'light', t: 'Nouveau', s: 'la carte d’hiver' },
  { k: 'gray', t: 'Sur le quai', s: 'coucher de soleil' },
  { k: 'blue', t: 'Réservez', s: 'pour les fêtes' },
  { k: 'light', t: 'Merci', s: 'à vous' },
]

function SocialScreen() {
  const filled = useSceneStep(1, POSTS.length + 1)
  return (
    <div className="ps-screen ps-social">
      <StatusBar />
      <div className="ps-ighead">
        <span className="ps-igavatar" />
        <div>
          <div className="ps-title sm">votre.commerce</div>
          <div className="ps-skel w60" />
          <div className="ps-skel w40" />
        </div>
      </div>
      <div className="ps-tabs">
        <span className="on">Publications</span>
        <span>Programmées</span>
      </div>
      <div className="ps-grid">
        {POSTS.map((p, i) => (
          <div key={i} className={`ps-tile ${p.k}${i < filled ? ' in' : ''}`} style={{ ['--d' as string]: `${(i % 3) * 40}ms` }}>
            <span className="ps-tile-empty">+</span>
            <span className="ps-tile-body">
              <b>{p.t}</b>
              {p.s ? <em>{p.s}</em> : null}
            </span>
          </div>
        ))}
      </div>
      <div className={`ps-toast${filled > POSTS.length ? ' in' : ''}`}>
        <span className="ps-dot" /> Un mois programmé · 20 min cette semaine
      </div>
    </div>
  )
}

const LINES = [
  { l: 'Plateaux de fruits de mer × 10', p: '450,00 €' },
  { l: 'Tielles sétoises × 40', p: '160,00 €' },
  { l: 'Service et mise en place', p: '220,00 €' },
]

function InvoiceScreen() {
  const step = useSceneStep(2, 6)
  return (
    <div className="ps-screen ps-invoice">
      <StatusBar />
      <div className="ps-appbar">
        <div>
          <div className="ps-kicker">Devis n° 2026-041</div>
          <div className="ps-title">Réception</div>
        </div>
        <span className={`ps-pill${step >= 6 ? ' ok' : ''}`}>{step >= 6 ? 'Envoyé ✓' : 'Brouillon'}</span>
      </div>
      <div className="ps-doc">
        <div className="ps-docrow muted">
          <span>Client</span>
          <span>Mariage, 40 personnes</span>
        </div>
        <div className="ps-docrow muted">
          <span>Date</span>
          <span>Samedi 12 juin</span>
        </div>
        <div className="ps-sep" />
        {LINES.map((ln, i) => (
          <div key={i} className={`ps-line${step > i ? ' in' : ''}`}>
            <span>{ln.l}</span>
            <span>{ln.p}</span>
          </div>
        ))}
        <div className={`ps-totals${step > 3 ? ' in' : ''}`}>
          <div>
            <span>Total HT</span>
            <span>830,00 €</span>
          </div>
          <div>
            <span>TVA 10 %</span>
            <span>83,00 €</span>
          </div>
          <div className="ttc">
            <span>Total TTC</span>
            <span>913,00 €</span>
          </div>
        </div>
      </div>
      <div className="ps-auto">
        <div>
          <b>Automatique</b>
          <span>Envoi et relance à J+7</span>
        </div>
        <span className={`ps-switch${step >= 5 ? ' on' : ''}`} role="switch" aria-checked={step >= 5} aria-label="Automatique">
          <i />
        </span>
      </div>
    </div>
  )
}

const CHAT: Array<{ who: 'c' | 'a' | 'typing' | 'sys'; t?: string }> = [
  { who: 'c', t: 'Bonjour, vous êtes ouverts dimanche midi ?' },
  { who: 'typing' },
  { who: 'a', t: 'Bonjour ! Oui, de 12 h à 14 h 30. Je vous réserve une table ?' },
  { who: 'c', t: 'Oui, 4 personnes à 12 h 30.' },
  { who: 'typing' },
  { who: 'a', t: 'C’est noté : dimanche 12 h 30, 4 couverts. Confirmation envoyée par SMS. À dimanche !' },
  { who: 'sys', t: 'Réservation ajoutée à votre agenda' },
]

function AgentScreen() {
  const step = useSceneStep(3, CHAT.length)
  // Une bulle « en train d'écrire » n'est visible que tant que la réponse n'est pas arrivée
  const visible = CHAT.map((m, i) => i < step && !(m.who === 'typing' && i < step - 1))
  return (
    <div className="ps-screen ps-agent">
      <StatusBar />
      <div className="ps-chathead">
        <span className="ps-botavatar">IA</span>
        <div>
          <div className="ps-title sm">Votre assistant</div>
          <div className="ps-online">
            <span className="ps-dot" /> En ligne, jour et nuit
          </div>
        </div>
      </div>
      <div className="ps-chat">
        {CHAT.map((m, i) =>
          m.who === 'typing' ? (
            <div key={i} className={`ps-bubble a typing${visible[i] ? ' in' : ''}`} aria-hidden={!visible[i]}>
              <i />
              <i />
              <i />
            </div>
          ) : (
            <div key={i} className={`ps-bubble ${m.who}${visible[i] ? ' in' : ''}`}>
              {m.t}
            </div>
          ),
        )}
      </div>
      <div className="ps-input">
        <span>Message</span>
      </div>
    </div>
  )
}

/** Les 4 écrans empilés ; seul l'écran de la scène active est visible. */
export function PhoneScreens() {
  const active = useActiveScene()
  return (
    <div className="ps-root" data-scene={active}>
      <div className={`ps-layer${active === 0 ? ' on' : ''}`}>
        <ReviewsScreen />
      </div>
      <div className={`ps-layer${active === 1 ? ' on' : ''}`}>
        <SocialScreen />
      </div>
      <div className={`ps-layer${active === 2 ? ' on' : ''}`}>
        <InvoiceScreen />
      </div>
      <div className={`ps-layer${active === 3 ? ' on' : ''}`}>
        <AgentScreen />
      </div>
      <div className="ps-glare" aria-hidden="true" />
    </div>
  )
}
