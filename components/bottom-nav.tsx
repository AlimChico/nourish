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
    <div className="pointer-events-none sticky bottom-0 z-30 w-full px-3 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-2">
      <nav
        aria-label="Main navigation"
        className="pointer-events-auto mx-auto flex w-full max-w-md items-stretch rounded-[1.65rem] bg-[#0d1813]/92 shadow-[0_14px_44px_rgba(0,0,0,0.55)] backdrop-blur-xl"
      >
        {tabs.map((t) => {
          const Icon = t.icon
          const isActive = active === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange(t.key)}
              aria-current={isActive ? "page" : undefined}
              className="group relative flex min-w-0 flex-1 flex-col items-center justify-start rounded-[1.4rem] py-2 transition-transform duration-150 active:scale-90"
            >
              {/* Active pill — lifts behind the icon */}
              <span
                className={cn(
                  "absolute left-1/2 top-[3px] h-[42px] w-[52px] -translate-x-1/2 rounded-[1.1rem] transition-all duration-300 ease-out",
                  isActive
                    ? "scale-100 bg-primary/18 opacity-100 shadow-[0_0_20px_rgba(52,211,153,0.3)]"
                    : "scale-50 opacity-0",
                )}
              />
              <Icon
                className={cn(
                  "relative h-[22px] w-[22px] transition-all duration-300 ease-out",
                  isActive
                    ? "-translate-y-[2px] text-primary drop-shadow-[0_0_10px_rgba(52,211,153,0.7)]"
                    : "translate-y-0 text-muted-foreground group-active:text-[#e6fff1]",
                )}
                strokeWidth={isActive ? 2.4 : 1.85}
              />
              <span
                className={cn(
                  "relative mt-0.5 text-[9.5px] font-bold leading-none tracking-tight transition-colors duration-300",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                {t.label}
              </span>
              {/* Underline dot */}
              <span
                className={cn(
                  "relative mt-1 h-1 w-1 rounded-full bg-primary transition-all duration-300",
                  isActive ? "scale-100 opacity-100" : "scale-0 opacity-0",
                )}
              />
            </button>
          )
        })}
      </nav>
    </div>
  )
}
