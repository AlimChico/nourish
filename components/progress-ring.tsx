"use client"

import { cn } from "@/lib/utils"

type ProgressRingProps = {
  value: number
  max: number
  size?: number
  strokeWidth?: number
  className?: string
  trackClassName?: string
  progressClassName?: string
  children?: React.ReactNode
  rounded?: boolean
}

export function ProgressRing({
  value,
  max,
  size = 220,
  strokeWidth = 16,
  className,
  trackClassName = "text-muted",
  progressClassName = "text-primary",
  children,
  rounded = true,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const pct = Math.min(value / max, 1)
  const offset = circumference * (1 - pct)

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={cn("stroke-current", trackClassName)}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap={rounded ? "round" : "butt"}
          className={cn("stroke-current transition-[stroke-dashoffset] duration-1000 ease-out", progressClassName)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  )
}
