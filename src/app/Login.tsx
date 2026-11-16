// Connexion : lien magique par e-mail (principal), Google en option, mot de passe pour les comptes de test.
import { useEffect, useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import { ArrowRight, KeyRound, Mail } from 'lucide-react'
import { useBackend } from './state'
import { DEMO_LOGINS } from './data/seed'
import { Button, enter } from './ui/kit'

const ERRORS: Record<string, string> = {
  'invalid-credentials': 'E-mail ou mot de passe incorrect.',
}

export function Login({ area }: { area: 'espace' | 'admin' }) {
  const backend = useBackend()
  const params = new URLSearchParams(window.location.search)
  const ref = params.get('ref')?.toUpperCase() ?? null
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [withPassword, setWithPassword] = useState(backend.mode === 'demo')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [refereePercent, setRefereePercent] = useState<number | null>(null)

  useEffect(() => {
    if (!ref) return
    backend
      .getSettings()
      .then((s) => setRefereePercent(s.refereePercent))
      .catch(() => setRefereePercent(null))
  }, [backend, ref])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError('Saisissez une adresse e-mail valide.')
      return
    }
    setBusy(true)
    try {
      if (withPassword) await backend.signInWithPassword(email, password)
      else {
        await backend.sendMagicLink(email, ref)
        setSent(backend.mode !== 'demo')
      }
    } catch (err) {
      setError(ERRORS[(err as Error).message] ?? 'Connexion impossible. Réessayez dans un instant.')
    } finally {
      setBusy(false)
    }
  }

  const fill = (kind: 'client' | 'admin') => {
    setWithPassword(true)
    setEmail(DEMO_LOGINS[kind].email)
    setPassword(DEMO_LOGINS[kind].password)
  }

  return (
    <div className="login">
      <motion.div className="login-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={enter}>
        <a className="logo" href="/" aria-label="MJ FORM, retour au site" style={{ fontSize: 22 }}>
          MJ<span className="dot">.</span> FORM
        </a>
        <h1 className="page-title" style={{ fontSize: 30, marginTop: 28 }}>
          {area === 'admin' ? 'Administration.' : ref ? 'Bienvenue.' : 'Votre espace.'}
        </h1>
        <p className="page-sub" style={{ marginBottom: 24 }}>
          {area === 'admin'
            ? 'Accès réservé à l’équipe MJ FORM.'
            : ref
              ? refereePercent
                ? `Vous êtes invité par un membre MJ FORM : -${refereePercent} % sur votre première formation.`
                : 'Vous êtes invité par un membre MJ FORM : une réduction vous attend sur votre première formation.'
              : 'Vos formations, vos ressources, votre progression.'}
        </p>

        {sent ? (
          <div className="panel soft" role="status">
            <p style={{ margin: 0 }}>
              <strong>Lien envoyé.</strong> Ouvrez l’e-mail reçu sur <strong>{email}</strong> et touchez le lien pour vous connecter.
            </p>
          </div>
        ) : (
          <form className="stack" onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="email">Adresse e-mail</label>
              <input id="email" className="input" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(error) || undefined} aria-describedby={error ? 'login-err' : undefined} required />
            </div>
            {withPassword ? (
              <div className="field">
                <label htmlFor="password">Mot de passe</label>
                <input id="password" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            ) : null}
            {error ? (
              <p id="login-err" className="field err" role="alert" style={{ margin: 0 }}>
                {error}
              </p>
            ) : null}
            <Button type="submit" block loading={busy}>
              {withPassword ? 'Se connecter' : 'Recevoir mon lien de connexion'}
              {!busy ? <ArrowRight aria-hidden="true" /> : null}
            </Button>
            {backend.mode === 'supabase' ? (
              <Button variant="ghost" block onClick={() => backend.signInWithGoogle(ref)}>
                Continuer avec Google
              </Button>
            ) : null}
            <button type="button" className="linkish small" onClick={() => setWithPassword((v) => !v)} style={{ justifySelf: 'center' }}>
              {withPassword ? (
                <>
                  <Mail size={14} aria-hidden="true" style={{ verticalAlign: -2, marginRight: 6 }} />
                  Recevoir un lien par e-mail plutôt
                </>
              ) : (
                <>
                  <KeyRound size={14} aria-hidden="true" style={{ verticalAlign: -2, marginRight: 6 }} />
                  Se connecter avec un mot de passe
                </>
              )}
            </button>
          </form>
        )}

        {backend.mode === 'demo' ? (
          <div className="demo-box">
            <p className="small" style={{ margin: '0 0 10px' }}>
              <strong>Espace de test.</strong> Données fictives, rien n’est envoyé ni débité.
            </p>
            <div className="row wrap" style={{ gap: 8 }}>
              <Button size="sm" variant="ghost" onClick={() => fill('client')}>
                Compte client
              </Button>
              <Button size="sm" variant="ghost" onClick={() => fill('admin')}>
                Compte admin
              </Button>
            </div>
            <p className="tiny muted" style={{ margin: '10px 0 0' }}>
              {DEMO_LOGINS.client.email} · {DEMO_LOGINS.client.password} — {DEMO_LOGINS.admin.email} · {DEMO_LOGINS.admin.password}
            </p>
          </div>
        ) : null}
      </motion.div>
    </div>
  )
}
