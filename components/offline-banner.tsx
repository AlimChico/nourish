"use client"

import { useEffect, useState } from "react"
import { CloudOff, RefreshCw, AlertTriangle } from "lucide-react"
import { retryAllPushes, useSync } from "@/lib/sync"

/**
 * Bandeau hors-ligne / synchro.
 *
 * L'app reste 100 % utilisable sans réseau (localStorage = source de vérité
 * immédiate) : les repas scannés, photographiés ou saisis sont conservés
 * localement puis re-poussés au retour de la connexion. Deux états visibles :
 *  - réseau coupé  → bandeau ambre « hors-ligne » ;
 *  - nuage injoignable ou en erreur alors que le réseau est là → bandeau ambre
 *    avec bouton « Réessayer » qui re-pousse tous les stores d'un coup.
 * Aucun plantage, aucune perte : le pire cas est un décalage de synchro annoncé.
 */
export function OfflineBanner() {
  const { syncError } = useSync()
  const [online, setOnline] = useState(true)
  const [wasOffline, setWasOffline] = useState(false)
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    setOnline(navigator.onLine)
    const on = () => {
      setOnline(true)
      // Le réseau revient : on re-pousse immédiatement les stores modifiés
      // pendant la coupure. Sans ça, les repas et l'eau loggés hors ligne
      // attendraient une nouvelle modification pour partir — et seraient perdus
      // si l'app était fermée entre-temps.
      retryAllPushes()
    }
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

  const retry = () => {
    setRetrying(true)
    retryAllPushes()
    window.setTimeout(() => setRetrying(false), 1200)
  }

  if (!online) {
    return (
      <div className="animate-fade-in flex items-center gap-2 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-3.5 py-2.5">
        <CloudOff className="h-4 w-4 shrink-0 text-amber-300" />
        <p className="text-xs font-semibold text-amber-200">
          Hors-ligne — tout est gardé, synchro dès le retour du réseau.
        </p>
      </div>
    )
  }

  if (syncError) {
    return (
      <div className="animate-fade-in flex items-center gap-2 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-3.5 py-2.5">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
        <p className="min-w-0 flex-1 text-xs font-semibold text-amber-200">
          Synchro interrompue — tes données restent sur ton appareil.
        </p>
        <button
          type="button"
          onClick={retry}
          disabled={retrying}
          className="flex shrink-0 items-center gap-1 rounded-xl bg-amber-400/20 px-2.5 py-1.5 text-[11px] font-bold text-amber-100 active:scale-95 disabled:opacity-60"
        >
          <RefreshCw className={retrying ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          Réessayer
        </button>
      </div>
    )
  }

  if (wasOffline) {
    return (
      <div className="animate-fade-in flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-3.5 py-2.5">
        <RefreshCw className="h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs font-semibold text-primary">De retour en ligne — synchronisation en cours…</p>
      </div>
    )
  }

  return null
}
