import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Manrope } from 'next/font/google'
import { VisitTracker } from '@/components/visit-tracker'
import './globals.css'

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
})

export const metadata: Metadata = {
  // Base pour les images Open Graph / canonical — VERCEL_URL est fournie
  // automatiquement par Vercel en production (et preview).
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'),
  ),
  title: 'Sahtek — Your Health. Our Priority.',
  description:
    'Track your nutrition, reach your goals, and become a healthier version of yourself.',
  keywords: [
    'nutrition Tunisie',
    'compteur calories',
    'coach nutrition',
    'maigrir Tunisie',
    'prise de muscle',
    'couscous',
    'lablabi',
    'scan repas',
    'food tracker',
    'Sahtek',
  ],
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    siteName: 'Sahtek',
    title: 'Sahtek — ton coach nutrition tunisien 🇹🇳',
    description:
      'Scanne tes plats, compte tes calories et atteins tes objectifs avec un coach qui parle derja, français et anglais.',
    locale: 'fr_TN',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sahtek — ton coach nutrition tunisien 🇹🇳',
    description: 'Scanne tes plats, compte tes calories, atteins tes objectifs.',
  },
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    // iOS : carré plein 180×180 — iOS applique lui-même ses coins arrondis
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.webmanifest',
  // Next.js 16 n'émet plus que le tag normalisé `mobile-web-app-capable`
  // (l'ancien `apple-mobile-web-app-capable` a été déprécié côté Next).
  // iOS s'appuie toujours sur le tag Apple — sans lui, « Sur l'écran d'accueil »
  // rouvre l'app dans un onglet Safari avec la barre d'adresse au lieu du plein
  // écran, et les startup images ne s'affichent pas. On émet donc les deux.
  other: {
    'apple-mobile-web-app-capable': 'yes',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Sahtek',
  },
}

export const viewport: Viewport = {
  // #0b0f0d = couleur EXACTE du fond de l'app (aurora-bg) : la barre de statut,
  // la zone Dynamic Island et le home indicator prennent la couleur de l'app
  // → rendu plein écran homogène « vraie app », sans bande de couleur différente.
  themeColor: '#0b0f0d',
  // viewport-fit=cover : le contenu s'étend sous l'encoche/la barre d'accueil,
  // et env(safe-area-inset-*) devient réel — MobileFrame + BottomNav s'en servent
  // (safe-top / safe-bottom) pour ne jamais passer sous la barre de statut iOS
  // ni sous le geste Accueil, en portrait comme en paysage.
  // Zoom rétabli (accessibilité) : plus de maximumScale=1.
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // Android Chrome : quand le clavier s'ouvre (chat, formulaires), la fenêtre
  // est redimensionnée au lieu de faire glisser le viewport par-dessus —
  // les inputs restent visibles et le layout ne saute pas.
  interactiveWidget: 'resizes-content',
}

// URL canonique pour le JSON-LD (moteurs de recherche).
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://nourish-roan.vercel.app')

// Rich result Google : application web de santé, gratuite.
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Sahtek',
  applicationCategory: 'HealthApplication',
  operatingSystem: 'Web',
  url: APP_URL,
  description:
    'Coach nutrition tunisien : scan de plats, calories, macros, rappels — en derja, français et anglais.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
}

// Enveloppe native (Capacitor / APK) : la barre de statut Android est repeinte
// aux couleurs du thème courant. Le pont Capacitor n'existe que dans l'app
// native — le site web ignore donc complètement ce script (aucun coût).
// setBackgroundColor est déprécié depuis Android 15 (bord-à-bord imposé) :
// l'échec est silencieux et sans conséquence, le fond de l'app assure la
// continuité visuelle.
const nativeShellInit = `(function(){var C=window.Capacitor;if(!C||!C.isNativePlatform||!C.isNativePlatform())return;function a(){var d=document.documentElement.classList.contains('dark');var s=C.Plugins&&C.Plugins.StatusBar;if(!s)return;if(s.setStyle){s.setStyle({style:d?'DARK':'LIGHT'}).catch(function(){})}if(s.setBackgroundColor){s.setBackgroundColor({color:d?'#0b0f0d':'#f2faf6'}).catch(function(){})}}a();if(window.MutationObserver){new MutationObserver(a).observe(document.documentElement,{attributes:true,attributeFilter:['class']})}})();`

const themeInit = `try{var t=localStorage.getItem('nourish.theme.v1');var d=t!=='light';var r=document.documentElement;r.classList.toggle('dark',d);r.classList.toggle('light',!d);var m=document.querySelector('meta[name=theme-color]');if(m){m.setAttribute('content',d?'#0b0f0d':'#f2faf6')}}catch(e){}`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`dark ${manrope.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        {/* Google AdSense — verified-site snippet (required in <head> on every page). */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4994351868321038"
          crossOrigin="anonymous"
        />
      </head>
      <body className="font-sans antialiased">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <VisitTracker />
        {children}
        {/* Service worker: production only — in dev it would serve stale bundles,
            and we actively unregister/clean any left-over registration. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              process.env.NODE_ENV === 'production'
                ? `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').then(function(reg){function ping(){reg.update().catch(function(){})}ping();setInterval(ping,3600000);document.addEventListener('visibilitychange',function(){if(!document.hidden){ping()}});var had=!!navigator.serviceWorker.controller;navigator.serviceWorker.addEventListener('controllerchange',function(){if(had){setTimeout(function(){location.reload()},50)}had=true})}).catch(function(){})})}`
                : `if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(function(rs){rs.forEach(function(r){r.unregister()})});if(window.caches){caches.keys().then(function(ks){ks.forEach(function(k){caches.delete(k)})})}}`,
          }}
        />
        <script dangerouslySetInnerHTML={{ __html: nativeShellInit }} />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
