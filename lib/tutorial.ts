/**
 * Tutoriel d'introduction — drapeau local, volontairement indépendant du compte.
 *
 * Pourquoi local et pas dans `AccountState` : le tutoriel explique l'interface de
 * CET appareil (où sont les boutons), il doit donc pouvoir se rejouer par
 * appareil. Il est aussi versionné : passer `TUTORIAL_VERSION` à 2 réaffiche le
 * parcours à tout le monde, une seule fois, quand de vraies nouveautés arrivent.
 */

export const TUTORIAL_VERSION = 1

const KEY = "sahtek.tutorial.v1"

/** Le parcours de la version courante a-t-il déjà été vu ? */
export function tutorialSeen(): boolean {
  try {
    return Number(window.localStorage.getItem(KEY) ?? 0) >= TUTORIAL_VERSION
  } catch {
    // Stockage indisponible (navigation privée saturée…) : on ne bloque JAMAIS
    // l'utilisateur derrière un tutoriel qu'on ne peut pas mémoriser.
    return true
  }
}

/** Marque le parcours comme vu. */
export function markTutorialSeen(): void {
  try {
    window.localStorage.setItem(KEY, String(TUTORIAL_VERSION))
  } catch {
    // ignoré : au pire le tutoriel se remontre une fois
  }
}
