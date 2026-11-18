// Un compte admin qui ouvre /espace est envoyé vers l'administration,
// sauf s'il a choisi « Voir l'espace stagiaire » (aperçu, mémorisé le temps de l'onglet).
const KEY = 'mjform-apercu-stagiaire'

export function previewAllowed() {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function setPreview(on: boolean) {
  try {
    if (on) sessionStorage.setItem(KEY, '1')
    else sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
