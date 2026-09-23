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
 * Sends the captured photo to /api/scan-meal (real AI vision) and returns a
 * detailed, structured breakdown of everything the model recognized.
 */
export async function analyzeMealReal(thumbnail?: string): Promise<ScanResult> {
  const id = `scan_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
  const scannedAt = Date.now()

  if (!thumbnail) {
    return {
      id,
      dish: "No image",
      description: "Capture a photo of your plate first.",
      tips: "",
      source: "demo",
      items: [],
      scannedAt,
    }
  }

  const res = await fetch("/api/scan-meal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ image: thumbnail }),
  })

  if (!res.ok) {
    throw new Error(`Scan failed (${res.status})`)
  }

  const data = (await res.json()) as {
    dish: string
    description: string
    tips: string
    source: "ai" | "demo"
    items: ScannedItem[]
    error?: string
  }

  return {
    id,
    dish: data.dish,
    description: data.description,
    tips: data.tips,
    source: data.source,
    items: data.items,
    thumbnail,
    scannedAt,
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
