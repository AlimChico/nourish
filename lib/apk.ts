"use client"

/**
 * Téléchargement de l'APK Android depuis l'app web.
 *
 * L'APK est un binaire : il ne peut pas être « généré » à la volée par Next, il
 * doit être hébergé. Deux emplacements sont supportés, dans cet ordre :
 *
 *  1. `NEXT_PUBLIC_APK_URL` (variable d'environnement) — pour un hébergement
 *     externe, typiquement un asset GitHub Releases :
 *     `https://github.com/<user>/<repo>/releases/latest/download/sahtek.apk`
 *     L'URL « latest » pointe toujours sur la dernière release publiée.
 *  2. Par défaut : `/downloads/sahtek.apk`, servi par le site lui-même depuis
 *     `public/downloads/`. C'est le chemin le plus simple : dépose le fichier,
 *     committe-le, et Vercel le sert — le lien est alors immédiatement valable
 *     pour tous tes utilisateurs Android.
 *
 * `.gitignore` ignore tous les `*.apk` (pour ne pas committer les sorties de
 * build du dossier `android/`) ; `public/downloads/*.apk` est explicitement
 * ré-autorisé, sinon le fichier ne partirait jamais en production.
 */

import { useEffect, useState } from "react"

const ENV_URL = process.env.NEXT_PUBLIC_APK_URL

/** URL de l'APK, telle qu'elle sera mise dans le `href` du bouton. */
export const APK_URL = (ENV_URL && ENV_URL.trim()) || "/downloads/sahtek.apk"

/** Nom du fichier proposé au téléchargement (Android n'aime pas les noms exotiques). */
export const APK_FILENAME = "sahtek-android.apk"

/** URL absolue (hébergement externe) : on ne peut pas la sonder en HEAD (CORS). */
const EXTERNAL = /^https?:\/\//i.test(APK_URL)

export type ApkStatus = "checking" | "ready" | "missing"

export type ApkInfo = {
  /** `missing` = le fichier n'est pas (encore) publié sur ce déploiement. */
  status: ApkStatus
  /** Taille en octets, quand le serveur l'annonce. */
  size: number | null
}

// Une seule sonde par chargement de page : la carte et la ligne des réglages
// affichent le même état, sans deux requêtes.
let cached: ApkInfo | null = null

/**
 * L'APK est-il réellement téléchargeable ? On sonde une fois en HEAD.
 *
 * Pourquoi sonder plutôt que d'afficher le bouton inconditionnellement : un
 * bouton « Télécharger » qui mène à une 404 est pire que pas de bouton. Et pour
 * une URL externe, une sonde serait bloquée par le CORS (GitHub redirige vers un
 * autre domaine) : on la considère donc disponible d'office.
 */
export function useApk(): ApkInfo {
  const [info, setInfo] = useState<ApkInfo>(() => cached ?? { status: "checking", size: null })

  useEffect(() => {
    if (cached) return
    if (EXTERNAL) {
      cached = { status: "ready", size: null }
      setInfo(cached)
      return
    }
    let alive = true
    fetch(APK_URL, { method: "HEAD", cache: "no-store" })
      .then((res) => {
        if (!res.ok) return { status: "missing" as const, size: null }
        const len = Number(res.headers.get("content-length") ?? 0)
        return { status: "ready" as const, size: len > 0 ? len : null }
      })
      .catch(() => ({ status: "missing" as const, size: null }))
      .then((next) => {
        cached = next
        if (alive) setInfo(next)
      })
    return () => {
      alive = false
    }
  }, [])

  return info
}

/** « 6,4 Mo » — Unités décimales, comme Android les affiche. */
export function formatSize(bytes: number | null): string | null {
  if (!bytes || bytes <= 0) return null
  if (bytes < 1000 * 1000) return `${Math.round(bytes / 1000)} ko`
  return `${(bytes / (1000 * 1000)).toFixed(1).replace(".", ",")} Mo`
}
