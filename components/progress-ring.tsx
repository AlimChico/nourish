"use client"

import { cn } from "@/lib/utils"

type ProgressRingProps = {
  value: number
  max: number
  /** Taille fixe optionnelle (px). Omise → fluide : le ring suit la largeur du conteneur (aspect-square). */
  size?: number
  strokeWidth?: number
  className?: string
  trackClassName?: string
  progressClassName?: string
  children?: React.ReactNode
  rounded?: boolean
}

/**
 * Anneau de progression proportionné : le tracé vit dans un viewBox carré, donc
 * il s'étire sans se déformer du mobile (fluid) à la tablette. Passez `size`
 * seulement pour forcer une taille fixe.
 */
export function ProgressRing({
  value,
  max,
  size,
  strokeWidth = 16,
  className,
  trackClassName = "text-muted",
  progressClassName = "text-primary",
  children,
  rounded = true,
}: ProgressRingProps) {
  const vSize = 220 // viewBox arbitraire → scaling vectoriel homothétique
  const vStroke = strokeWidth * (vSize / (size ?? vSize))
  const radius = (vSize - vStroke) / 2
  const circumference = 2 * Math.PI * radius
  const pct = Math.min(value / max, 1)
  const offset = circumference * (1 - pct)

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", !size && "w-full", className)}
      style={size ? { width: size, height: size } : undefined}
    >
      <svg viewBox={`0 0 ${vSize} ${vSize}`} className={cn("w-full -rotate-90", !size && "aspect-square")}>
        <circle
          cx={vSize / 2}
          cy={vSize / 2}
          r={radius}
          fill="none"
          strokeWidth={vStroke}
          className={cn("stroke-current", trackClassName)}
        />
        <circle
          cx={vSize / 2}
          cy={vSize / 2}
          r={radius}
          fill="none"
          strokeWidth={vStroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap={rounded ? "round" : "butt"}
          className={cn("stroke-current transition-[stroke-dashoffset] duration-1000 ease-out", progressClassName)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}
