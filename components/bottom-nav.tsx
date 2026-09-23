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
    <nav
      className="sticky bottom-0 z-30 w-full shrink-0 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      aria-label="Main navigation"
    >
      {/* max-w + mx-auto keeps the 5 tabs centered and even on wide screens */}
      <div className="mx-auto flex w-full max-w-lg items-stretch px-2 pt-1.5">
        {tabs.map((t) => {
          const Icon = t.icon
          const isActive = active === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange(t.key)}
              className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-1.5 active:scale-95"
              aria-current={isActive ? "page" : undefined}
            >
              <span
                className={cn(
                  "flex h-9 w-14 items-center justify-center rounded-full transition-colors",
                  isActive && "bg-accent",
                )}
              >
                <Icon
                  className={cn("h-5 w-5 transition-colors", isActive ? "text-primary" : "text-muted-foreground")}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </span>
              <span
                className={cn(
                  "truncate text-[10px] font-semibold leading-none",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                {t.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
