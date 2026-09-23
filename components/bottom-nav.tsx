"use client"

import { Home, Utensils, TrendingUp, Dumbbell, User } from "lucide-react"
import { cn } from "@/lib/utils"

export type TabKey = "home" | "food" | "progress" | "workout" | "profile"

const tabs: { key: TabKey; label: string; icon: typeof Home }[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "food", label: "Food", icon: Utensils },
  { key: "progress", label: "Progress", icon: TrendingUp },
  { key: "workout", label: "Workout", icon: Dumbbell },
  { key: "profile", label: "Profile", icon: User },
]

export function BottomNav({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    <nav className="border-t border-border bg-card/95 px-2 pb-6 pt-2 backdrop-blur">
      <div className="flex items-center justify-around">
        {tabs.map((t) => {
          const Icon = t.icon
          const isActive = active === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange(t.key)}
              className="flex flex-1 flex-col items-center gap-1 py-1"
              aria-current={isActive ? "page" : undefined}
            >
              <span
                className={cn(
                  "flex h-9 w-12 items-center justify-center rounded-full transition-colors",
                  isActive && "bg-accent",
                )}
              >
                <Icon
                  className={cn("h-5 w-5 transition-colors", isActive ? "text-primary" : "text-muted-foreground")}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </span>
              <span className={cn("text-[10px] font-semibold", isActive ? "text-primary" : "text-muted-foreground")}>
                {t.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
