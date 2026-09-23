"use client"

import { cn } from "@/lib/utils"

type BarChartProps = {
  data: { day: string; value: number; target?: number }[]
  max?: number
  className?: string
  barClassName?: string
  unit?: string
}

export function BarChart({ data, max, className, barClassName = "bg-primary", unit }: BarChartProps) {
  const peak = max ?? Math.max(...data.map((d) => d.value)) * 1.1

  return (
    <div className={cn("flex items-end justify-between gap-2", className)}>
      {data.map((d) => {
        const h = Math.max((d.value / peak) * 100, 4)
        return (
          <div key={d.day} className="flex flex-1 flex-col items-center gap-2">
            <div className="relative flex h-32 w-full items-end justify-center">
              {d.target ? (
                <div
                  className="absolute left-0 right-0 border-t border-dashed border-muted-foreground/40"
                  style={{ bottom: `${Math.min((d.target / peak) * 100, 100)}%` }}
                />
              ) : null}
              <div
                className={cn("w-full max-w-8 rounded-full transition-all duration-700", barClassName)}
                style={{ height: `${h}%` }}
              />
            </div>
            <span className="text-xs font-medium text-muted-foreground">{d.day}</span>
          </div>
        )
      })}
    </div>
  )
}

type LineChartProps = {
  data: { label: string; value: number }[]
  className?: string
  stroke?: string
  fill?: string
}

export function LineChart({ data, className, stroke = "var(--primary)", fill = "var(--primary)" }: LineChartProps) {
  const w = 300
  const h = 120
  const pad = 8
  const values = data.map((d) => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const points = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2)
    const y = pad + (1 - (d.value - min) / range) * (h - pad * 2)
    return { x, y }
  })

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")
  const area = `${path} L ${points[points.length - 1].x} ${h} L ${points[0].x} ${h} Z`

  return (
    <div className={cn("w-full", className)}>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height: 140 }}>
        <defs>
          <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fill} stopOpacity="0.25" />
            <stop offset="100%" stopColor={fill} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#lineFill)" />
        <path d={path} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="white" stroke={stroke} strokeWidth="2.5" />
        ))}
      </svg>
      <div className="mt-2 flex justify-between px-1">
        {data.map((d) => (
          <span key={d.label} className="text-[10px] font-medium text-muted-foreground">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  )
}
