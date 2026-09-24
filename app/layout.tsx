import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Manrope } from 'next/font/google'
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
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Sahtek',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4fbf7' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0f0d' },
  ],
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

const themeInit = `try{var t=localStorage.getItem('nourish.theme.v1');var d=t!=='light';var r=document.documentElement;r.classList.toggle('dark',d);r.classList.toggle('light',!d)}catch(e){}`

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
        {children}
        {/* Service worker: production only — in dev it would serve stale bundles,
            and we actively unregister/clean any left-over registration. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              process.env.NODE_ENV === 'production'
                ? `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}`
                : `if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(function(rs){rs.forEach(function(r){r.unregister()})});if(window.caches){caches.keys().then(function(ks){ks.forEach(function(k){caches.delete(k)})})}}`,
          }}
        />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
