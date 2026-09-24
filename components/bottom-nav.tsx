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

/**
 * Floating glass tab bar — compact, dark translucent, one soft green capsule
 * behind the active tab only. Safe-area aware for iPhones.
 */
export function BottomNav({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    // Phone: min 56px of clearance + home-indicator safe area (≥ 44px touch targets).
    // Tablet (sm): floating pill narrower than the card, roomier padding.
    <div className="pointer-events-none sticky bottom-0 z-30 w-full px-3 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-2 sm:px-6 sm:pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
      <nav
        aria-label="Main navigation"
        className="pointer-events-auto mx-auto flex w-full max-w-md items-stretch rounded-[1.55rem] border border-[#a7f3d0]/15 bg-[#0d1a13]/90 shadow-[0_10px_32px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(167,243,208,0.07)] backdrop-blur-xl"
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
              className="group relative flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center rounded-[1.3rem] py-2 transition-transform duration-150 active:scale-90 sm:min-h-[60px] sm:py-2.5"
            >
              {/* Active capsule — only behind the selected tab */}
              <span
                className={cn(
                  "absolute left-1/2 top-1 h-[40px] w-[48px] -translate-x-1/2 rounded-2xl transition-all duration-300 ease-out sm:h-[2.75rem] sm:w-[3.5rem]",
                  isActive ? "scale-100 bg-primary/16 opacity-100" : "scale-75 opacity-0",
                )}
              />
              <Icon
                className={cn(
                  "relative h-[21px] w-[21px] transition-colors duration-200 sm:h-6 sm:w-6",
                  isActive ? "text-primary" : "text-muted-foreground group-active:text-[#e6fff1]",
                )}
                strokeWidth={isActive ? 2.3 : 1.8}
              />
              <span
                className={cn(
                  "relative mt-0.5 text-[9.5px] font-bold leading-none tracking-tight transition-colors duration-200 sm:text-[0.6875rem]",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                {t.label}
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
