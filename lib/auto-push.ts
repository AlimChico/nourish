"use client"

import { useEffect, useState } from "react"
import { useSync } from "@/lib/sync"
import { useSmartNotifications } from "@/lib/notifications"

/**
 * Abonnement Web Push AUTOMATIQUE — l'utilisateur n'a rien à faire :
 *
 *  1. L'onboarding demande la permission notifications (étape dédiée).
 *  2. Dès que la permission est accordée ET qu'une session cloud existe,
 *     l'appareil s'abonne au push serveur (endpoint stocké en DB) —
 *     sans aucun tap supplémentaire, sans ouvrir Réglages.
 *  3. Le cron /api/push/cron (20h Tunis) envoie alors le digest à TOUS les
 *     appareils abonnés, app fermée — c'est le « push automatique ».
 *
 * Idempotent (set d'endpoints déjà envoyés) et silencieux : aucun état UI,
 * les erreurs sont ignorées (le toggle manuel de Réglages reste disponible).
 */
export function AutoPushBridge() {
  const { status } = useSync()
  const { permission } = useSmartNotifications()
  const [sent, setSent] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (status !== "authed") return
    if (permission !== "granted") return
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return

    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/push")
        const data = (await res.json()) as { configured: boolean; publicKey: string | null }
        if (cancelled || !data.configured || !data.publicKey) return

        const reg = await navigator.serviceWorker.ready
        const existing = await reg.pushManager.getSubscription()
        let registered = ""
        if (existing) {
          registered = existing.endpoint
          // Déjà abonné ? Un POST idempotent (upsert) répare un enregistrement
          // perdu (autre navigateur, purge DB) — pas cher.
          if (!sent.has(existing.endpoint)) {
            const json = existing.toJSON()
            await fetch("/api/push", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ endpoint: existing.endpoint, keys: json.keys }),
            })
          }
        } else {
          const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(data.publicKey),
          })
          const json = sub.toJSON()
          await fetch("/api/push", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint, keys: json.keys }),
          })
          registered = sub.endpoint
        }
        setSent((prev) => {
          const next = new Set(prev)
          if (registered) next.add(registered)
          return next
        })
      } catch {
        // Silencieux : l'utilisateur peut toujours s'abonner via Réglages.
      }
    })()

    return () => {
      cancelled = true
    }
    // `sent` volontairement hors deps : on ne veut pas re-tenter en boucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, permission])

  return null
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}
