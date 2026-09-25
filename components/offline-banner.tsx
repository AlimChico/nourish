"use client"

import { useEffect, useState } from "react"
import { CloudOff, RefreshCw } from "lucide-react"

/**
 * Bandeau hors-ligne — affiché quand le navigateur perd le réseau.
 * L'app reste 100% utilisable (localStorage) : les repas scannés, photographiés
 * ou saisis sont conservés localement puis synchronisés au retour de la
 * connexion (miroir cloud debouncé dans lib/sync, qui se déclenche dès que les
 * PUT réussissent à nouveau).
 */
export function OfflineBanner() {
  const [online, setOnline] = useState(true)
  const [wasOffline, setWasOffline] = useState(false)

  useEffect(() => {
    setOnline(navigator.onLine)
    const on = () => setOnline(true)
    const off = () => {
      setOnline(false)
      setWasOffline(true)
    }
    window.addEventListener("online", on)
    window.addEventListener("offline", off)
    return () => {
      window.removeEventListener("online", on)
      window.removeEventListener("offline", off)
    }
  }, [])

  if (online) {
    // Petit signal de reconnexion après une coupure, auto-effacé.
    if (!wasOffline) return null
    return (
      <div className="animate-fade-in flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-3.5 py-2.5">
        <RefreshCw className="h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs font-semibold text-primary">De retour en ligne — synchronisation en cours…</p>
      </div>
    )
  }

  return (
    <div className="animate-fade-in flex items-center gap-2 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-3.5 py-2.5">
      <CloudOff className="h-4 w-4 shrink-0 text-amber-300" />
      <p className="text-xs font-semibold text-amber-200">
        Hors-ligne — tout est sauvegardé, synchro dès le retour du réseau.
      </p>
    </div>
  )
}
