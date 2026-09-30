"use client"

import type { MealKey } from "@/lib/food-log"

export type ScannedItem = {
  name: string
  portion: string
  quantity: number
  calories: number
  protein: number
  carbs: number
  fat: number
  confidence: number
  detail: string
}

export type ScanResult = {
  id: string
  dish: string
  description: string
  tips: string
  source: "ai" | "demo"
  items: ScannedItem[]
  thumbnail?: string
  scannedAt: number
}

export type ScanPhase = "idle" | "uploading" | "analyzing" | "done" | "error"

/**
 * Pourquoi l'analyse a échoué — l'écran affiche un message DÉDIÉ par cas
 * (plus jamais un faux résultat générique quand le scanner est en panne) :
 *  - "unavailable" : le moteur IA ne répond pas (panne, clé absente, 5xx)
 *  - "quota"       : quota du moteur IA épuisé (429 côté fournisseur)
 *  - "offline"     : aucune connexion réseau côté téléphone
 *  - "noFood"      : la photo ne contient pas d'aliment reconnaissable
 *  - "badImage"    : la photo est illisible / trop lourde
 */
export type ScanErrorKind = "unavailable" | "quota" | "offline" | "noFood" | "badImage"

export class ScanError extends Error {
  kind: ScanErrorKind
  constructor(kind: ScanErrorKind, message: string) {
    super(message)
    this.name = "ScanError"
    this.kind = kind
  }
}

/**
 * Sends the captured photo to /api/scan-meal (real AI vision) and returns a
 * detailed, structured breakdown of everything the model recognized.
 * Lève une `ScanError` typée si le scanner est indisponible — jamais de
 * résultat inventé.
 */
export async function analyzeMealReal(thumbnail?: string): Promise<ScanResult> {
  const id = `scan_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
  const scannedAt = Date.now()

  if (!thumbnail) {
    throw new ScanError("badImage", "Aucune photo reçue — reprends la photo de ton plat.")
  }

  let res: Response
  try {
    res = await fetch("/api/scan-meal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ image: thumbnail }),
    })
  } catch {
    throw new ScanError("offline", "Pas de connexion — vérifie ton réseau puis réessaie.")
  }

  const data = (await res.json().catch(() => null)) as {
    dish?: string
    description?: string
    tips?: string
    source?: "ai" | "demo"
    items?: ScannedItem[]
    error?: string
    message?: string
  } | null

  if (!res.ok || !data) {
    if (data?.error === "AI_QUOTA" || data?.error === "RATE_LIMIT") {
      throw new ScanError("quota", data.message ?? "Le scanner est saturé — réessaie dans quelques minutes.")
    }
    if (data?.error === "BAD_IMAGE") {
      throw new ScanError("badImage", data.message ?? "Photo illisible — réessaie.")
    }
    throw new ScanError(
      "unavailable",
      data?.message ?? "Le scanner n'est pas disponible pour le moment.",
    )
  }

  const items = Array.isArray(data.items) ? data.items : []

  // « Pas de nourriture détectée » : l'API renvoie zéro item — on le signale
  // pour que l'écran affiche l'état dédié au lieu d'une liste vide.
  if (data.error === "NO_FOOD" || items.length === 0) {
    throw new ScanError(
      "noFood",
      data.message ??
        "Aucun aliment reconnu sur cette photo. Recadre l'assiette entière, avec de la lumière, et réessaie.",
    )
  }

  return {
    id,
    dish: data.dish ?? "Meal analysis",
    description: data.description ?? "",
    tips: data.tips ?? "",
    source: data.source ?? "ai",
    items,
    thumbnail,
    scannedAt,
  }
}

/**
 * Miniature persistable du plat scanné : carré 256px, JPEG qualité 0.62
 * (≈ 10–20 Ko). C'est ELLE qui reste sur le dashboard après l'enregistrement,
 * pas la photo 1024px envoyée au moteur IA (trop lourde pour localStorage et
 * pour le payload de synchro cloud).
 */
export async function makeScanThumbnail(
  dataUrl?: string,
  size = 256,
  quality = 0.62,
): Promise<string | undefined> {
  if (!dataUrl || typeof document === "undefined") return undefined
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = dataUrl
    })
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    if (!side) return undefined
    const canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext("2d")
    if (!ctx) return undefined
    const sx = (img.naturalWidth - side) / 2
    const sy = (img.naturalHeight - side) / 2
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)
    const out = canvas.toDataURL("image/jpeg", quality)
    // Trop lourde malgré la compression (photo très détaillée) : on préfère ne
    // pas persister de photo plutôt que de saturer le stockage local.
    return out.length <= 90_000 ? out : undefined
  } catch {
    return undefined
  }
}

export function scanTotals(items: ScannedItem[]) {
  return items.reduce(
    (acc, it) => ({
      calories: acc.calories + it.calories * it.quantity,
      protein: acc.protein + it.protein * it.quantity,
      carbs: acc.carbs + it.carbs * it.quantity,
      fat: acc.fat + it.fat * it.quantity,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

export function targetForTime(now = new Date()): MealKey {
  const h = now.getHours()
  if (h < 11) return "breakfast"
  if (h < 15) return "lunch"
  if (h < 21) return "dinner"
  return "snacks"
}
