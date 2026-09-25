"use client"

import { useEffect, useState } from "react"

const SEEN_KEY = "sahtek.splash.v1"
const HOLD_MS = 1700 // temps plein écran avant le fondu de sortie
const EXIT_MS = 350 // durée du fondu

/**
 * Écran de démarrage — logo centré sur le fond thème (vert/noir), animation
 * fade-in + scale, puis fondu de sortie vers l'app. Affiché une fois par
 * session de navigation (comme un cold-start natif), pas à chaque refresh.
 */
export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(SEEN_KEY)) {
        onDone()
        return
      }
      window.sessionStorage.setItem(SEEN_KEY, "1")
    } catch {
      // stockage indisponible — on affiche le splash quand même
    }
    const t1 = window.setTimeout(() => setLeaving(true), HOLD_MS)
    const t2 = window.setTimeout(onDone, HOLD_MS + EXIT_MS)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [onDone])

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#0b0f0d] transition-opacity duration-[350ms] ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="aurora-glow absolute inset-0" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icon.svg"
        alt=""
        className="splash-logo relative h-28 w-28 drop-shadow-[0_0_44px_rgba(52,211,153,0.45)] sm:h-32 sm:w-32"
      />
      <p className="splash-title relative mt-5 text-2xl font-black tracking-tight text-[#e6fff1]">Sahtek</p>
      <p className="splash-title relative mt-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-primary">
        Your Health. Our Priority.
      </p>
    </div>
  )
}
