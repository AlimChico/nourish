"use client"

import { Home, Utensils, TrendingUp, Dumbbell, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { haptic } from "@/lib/haptic"

export type TabKey = "home" | "food" | "progress" | "workout" | "profile"

const tabs: { key: TabKey; label: string; icon: typeof Home }[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "food", label: "Food", icon: Utensils },
  { key: "progress", label: "Progress", icon: TrendingUp },
  { key: "workout", label: "Workout", icon: Dumbbell },
  { key: "profile", label: "Profile", icon: User },
]

/**
 * Barre de navigation — définie UNE SEULE FOIS (rendue par page.tsx, jamais
 * dans les écrans) :
 *
 * - Mobile (< 480px) : `position: fixed` ancrée à la FENÊTRE (bottom/left/right),
 *   z-index élevé. Le contenu des écrans scrolle dans <main> (overflow-y:auto),
 *   donc la barre reste parfaitement stable pendant le scroll — y compris Safari
 *   iOS où le scroll du body déplacerait une barre sticky. Le padding-bottom
 *   intègre env(safe-area-inset-bottom) → aucun vide noir sous la barre sur
 *   iPhone (home indicator), et une marge visible au-dessus de la zone de geste.
 *
 * - Tablette/desktop (≥ 480px) : ancrée au bas du shell flottant (absolute),
 *   marge plus généreuse.
 *
 * Note hauteur : le shell utilise 100svh (hauteur du PETIT viewport, constante
 * même quand la barre d'URL Safari se cache) → la barre reste à la MÊME endroit
 * en permanence, jamais de saut ni de décalage.
 */
export function BottomNav({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 w-full px-3 sm:absolute sm:inset-x-0 sm:bottom-0 sm:z-30 sm:px-6 sm:pt-3">
      {/* Flou progressif iOS (mobile) : backdrop-blur masqué — flou fort au bord
          bas, qui s'efface en remontant. Le contenu qui passe sous la barre se
          fond doucement, sans bande de couleur. Fallback : sans backdrop-filter
          (vieux moteurs), la pilule opaque à 90 % masque déjà le contenu. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-24 sm:hidden"
        style={{
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          maskImage: "linear-gradient(to top, black 38%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to top, black 38%, transparent 100%)",
        }}
      />
      <nav
        aria-label="Main navigation"
        className="pointer-events-auto mx-auto mb-[calc(env(safe-area-inset-bottom,0px)+14px)] mt-2.5 flex w-full max-w-md items-stretch rounded-[1.55rem] border border-[#a7f3d0]/15 bg-[#0d1a13]/90 shadow-[0_18px_44px_rgba(0,0,0,0.55),0_4px_12px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(167,243,208,0.07)] backdrop-blur-xl sm:mb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:mt-0"
      >
        {tabs.map((t) => {
          const Icon = t.icon
          const isActive = active === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                haptic("light")
                onChange(t.key)
              }}
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
