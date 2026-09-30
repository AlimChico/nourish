import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor — enveloppe Android (et iOS plus tard) de Sahtek.
 *
 * MODE CHOISI : « WebView distant ».
 * L'app Sahtek est un Next.js rendu côté serveur avec 18 routes API
 * (session par cookie httpOnly, sync Supabase, scan IA, classement…).
 * Embarquer un export statique rendrait tous ces appels cross-origin :
 * les cookies `SameSite=Lax` ne partiraient plus et la connexion, la sync
 * et l'OAuth casseraient. On garde donc le WebView sur l'origine de prod :
 * l'app native et le site partagent exactement la même origine, donc
 * cookies, sessions, Supabase et OAuth fonctionnent sans une ligne de code
 * supplémentaire — et chaque déploiement Vercel est immédiatement en prod
 * dans l'APK, sans republier sur le Play Store.
 *
 * CONSÉQUENCE : `webDir` ne contient qu'une page de secours locale (voir
 * capacitor-www/). Elle ne dessert jamais l'app en marche, elle existe
 * parce que la CLI Capacitor exige un dossier d'assets non vide.
 *
 * HORS LIGNE : deux étages complémentaires.
 *  1. Le service worker (public/sw.js) précache la coquille de l'app : après
 *     UNE ouverture en ligne, l'app démarre et fonctionne sans réseau dans le
 *     WebView comme dans un navigateur.
 *  2. `server.errorPath` ci-dessous couvre le seul cas que le service worker ne
 *     peut pas couvrir : le tout premier lancement, hors ligne, avant que quoi
 *     que ce soit ait été mémorisé. Sans lui, Android afficherait la page
 *     d'erreur brute de Chromium (« Impossible d'atteindre le site »).
 *
 * NOTIFICATIONS : dans un WebView, l'API `Notification` du navigateur n'existe
 * pas — les rappels passent donc par @capacitor/local-notifications, planifiés
 * auprès d'Android (voir lib/native-notify.ts). Le Web Push (VAPID + cron) ne
 * concerne que le site : un WebView n'a pas de service worker de push.
 *
 * Note Play Store : le manifeste du plugin déclare SCHEDULE_EXACT_ALARM (pour
 * les rappels à la seconde). Sahtek ne l'utilise jamais — tous les rappels sont
 * planifiés en inexact (`isExactNotification: false`), ce qui évite à
 * l'utilisateur l'écran système « Alarmes et rappels ». La permission reste
 * déclarée, inutilisée, parce que le plugin en a besoin dès qu'on demande une
 * alarme exacte.
 */

// Une seule ligne à changer le jour où le domaine propre de Sahtek est en place.
// CAP_SERVER_URL permet de pointer vers un déploiement de préproduction.
const APP_URL = process.env.CAP_SERVER_URL ?? 'https://nourish-roan.vercel.app'

const APP_ID = 'com.sahtek.calories'

const config: CapacitorConfig = {
  appId: APP_ID,
  appName: 'Sahtek',
  webDir: 'capacitor-www',

  // #0b0f0d = fond réel de l'app : aucune bande de couleur au démarrage.
  backgroundColor: '#0b0f0d',

  server: {
    url: APP_URL,
    cleartext: false,
    androidScheme: 'https',
    // Page locale (capacitor-www/offline.html) affichée quand APP_URL est
    // injoignable — typiquement un premier lancement sans réseau.
    errorPath: 'offline.html',
    // Les domaines qui restent DANS le WebView au lieu d'ouvrir le
    // navigateur système. Sans Google/Apple ici, le retour d'OAuth
    // quitterait l'app et l'utilisateur atterrirait dans Chrome.
    allowNavigation: [
      'nourish-roan.vercel.app',
      '*.vercel.app',
      'accounts.google.com',
      '*.googleusercontent.com',
      'appleid.apple.com',
      '*.supabase.co',
    ],
  },

  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: true, // utile en debug, sans effet en release
    // Android 15+ impose l'affichage bord-à-bord : Capacitor 8 le gère
    // nativement (l'ancienne option adjustMarginsForEdgeToEdge a disparu).
    // La barre de statut opaque (voir plugins.StatusBar) suffit à ce que
    // rien ne passe sous l'encoche.
  },

  plugins: {
    // Écran de démarrage aux couleurs de l'app, sans spinner disgracieux.
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      backgroundColor: '#0b0f0dff',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: false,
      splashImmersive: false,
    },
    // Barre de statut opaque, exactement de la couleur du fond de l'app.
    // DARK = texte clair, pour un fond sombre (le thème par défaut de Sahtek).
    // overlaysWebView: false → le contenu ne glisse pas sous la barre d'état,
    // ce qui évite tout chevauchement indépendamment du support des safe areas.
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0b0f0d',
      overlaysWebView: false,
    },
  },
}

export default config
