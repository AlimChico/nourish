/**
 * Feedback haptique (vibration) — Android & la plupart des navigateurs mobiles.
 * No-op silencieux sur desktop / iOS Safari (qui ne supporte pas navigator.vibrate).
 * Utilisation : haptic("light") | haptic("medium") | haptic("success")...
 */

type Pattern = "light" | "medium" | "heavy" | "success" | "error"

const PATTERNS: Record<Pattern, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: [30, 40, 30],
  success: [15, 40, 25],
  error: [40, 60, 40],
}

export function haptic(pattern: Pattern = "light") {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(PATTERNS[pattern])
    }
  } catch {
    // ignore — vibration refusée ou non supportée
  }
}
