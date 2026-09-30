import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Largeur d'une barre de progression, en pourcentage — JAMAIS 0 %.
 *
 * Une barre invisible se lit comme un bug d'affichage ; un liseré de 2 % se lit
 * comme « pas encore commencé ». On garde donc toujours la barre visible, même
 * quand la valeur est nulle (finition UX #44).
 */
export function barWidth(pct: number, min = 2): string {
  const clean = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0
  return `${Math.max(clean, min)}%`
}
