"use client"

import { useEffect } from "react"

/**
 * Track une « ouverture » de l'app : au montage du layout, une requête
 * fire-and-forget vers /api/track. Throttle local : max 1 ping / 10 min par
 * onglet (sessionStorage) — le serveur dédoublonne de toute façon à
 * 1 visite/visiteur/jour. Aucun rendu, aucun état.
 */
export function VisitTracker() {
  useEffect(() => {
    try {
      const key = "sahtek.track.v1"
      const now = Date.now()
      const last = Number(sessionStorage.getItem(key) ?? 0)
      if (now - last < 10 * 60_000) return
      sessionStorage.setItem(key, String(now))
    } catch {
      // storage indisponible : on track quand même (le serveur dédoublonne)
    }
    void fetch("/api/track", { method: "POST", keepalive: true }).catch(() => {})
  }, [])

  return null
}
