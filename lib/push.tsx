"use client"

import { useCallback, useEffect, useState } from "react"

/**
 * Web Push côté client — enregistre l'abonnement auprès du SW et de l'API.
 * Graceful : si le serveur n'a pas de clés VAPID (configured=false), la UI
 * n'affiche pas l'option et tout reste fonctionnel.
 */

type Status = {
  supported: boolean
  configured: boolean
  subscribed: boolean
  loading: boolean
  error: string | null
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i)
  return output
}

export function usePushNotifications() {
  const [status, setStatus] = useState<Status>({
    supported: false,
    configured: false,
    subscribed: false,
    loading: true,
    error: null,
  })

  const refresh = useCallback(async () => {
    const supported =
      typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
    if (!supported) {
      setStatus({ supported: false, configured: false, subscribed: false, loading: false, error: null })
      return
    }
    try {
      const res = await fetch("/api/push")
      const data = (await res.json()) as { configured: boolean; publicKey: string | null }
      if (!data.configured) {
        setStatus({ supported: true, configured: false, subscribed: false, loading: false, error: null })
        return
      }
      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      setStatus({
        supported: true,
        configured: true,
        subscribed: Boolean(existing),
        loading: false,
        error: null,
      })
    } catch {
      setStatus({ supported: true, configured: false, subscribed: false, loading: false, error: null })
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const subscribe = useCallback(async () => {
    setStatus((s) => ({ ...s, loading: true, error: null }))
    try {
      const perm = await Notification.requestPermission()
      if (perm !== "granted") {
        setStatus((s) => ({ ...s, loading: false, error: "Permission refusée" }))
        return false
      }
      const res = await fetch("/api/push")
      const data = (await res.json()) as { configured: boolean; publicKey: string | null }
      if (!data.configured || !data.publicKey) {
        setStatus((s) => ({ ...s, loading: false, error: "Push non configuré sur le serveur" }))
        return false
      }
      const reg = await navigator.serviceWorker.ready
      // Réutilise l'abonnement existant, sinon en crée un.
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(data.publicKey),
        }))
      const json = sub.toJSON()
      const send = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint, keys: json.keys }),
      })
      if (!send.ok) throw new Error("register-failed")
      setStatus({ supported: true, configured: true, subscribed: true, loading: false, error: null })
      return true
    } catch {
      setStatus((s) => ({ ...s, loading: false, error: "Impossible d'activer le push" }))
      return false
    }
  }, [])

  const unsubscribe = useCallback(async () => {
    setStatus((s) => ({ ...s, loading: true, error: null }))
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch("/api/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setStatus({ supported: true, configured: true, subscribed: false, loading: false, error: null })
      return true
    } catch {
      setStatus((s) => ({ ...s, loading: false, error: "Impossible de désactiver le push" }))
      return false
    }
  }, [])

  return { ...status, subscribe, unsubscribe, refresh }
}
