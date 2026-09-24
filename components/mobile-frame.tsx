import { cn } from "@/lib/utils"

/**
 * App shell — responsive, safe-area aware :
 * - < 480px (téléphone, portrait & paysage) : plein écran, padding-top égal à
 *   env(safe-area-inset-top) → aucun contenu (ni l'aurora-glow pleine hauteur)
 *   ne passe derrière la barre de statut (heure/wifi/batterie).
 * - 480–1023px (tablette portrait & paysage) : carte flottante centrée, largeur
 *   fluide en min() (jamais de px fixes) ; les écrans réorganisent leurs grilles
 *   via les variantes sm: (2 colonnes repas/repas résultats/exercices/graphiques).
 * - ≥ 1024px (desktop) : carte ~56rem.
 */
export function MobileFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="aurora-bg safe-x flex min-h-dvh justify-center">
      <div
        className={cn(
          // Phone: locked to viewport height — full-bleed at the top, slight
          // rounding at the bottom only (no dark wedges around the notch area)
          "relative flex h-dvh w-full flex-col overflow-hidden bg-background safe-top",
          "rounded-b-[1.4rem]",
          // Tablet portrait / landscape: bigger floating rounded card, fluid width
          // (uses more of the screen than before — 52rem wide, 68rem tall max)
          "sm:my-auto sm:h-[94dvh] sm:max-h-[68rem] sm:w-[min(100vw-2.5rem,52rem)] sm:items-stretch sm:rounded-[2.5rem]",
          "lg:w-[min(92vw,60rem)]",
          "sm:shadow-[0_25px_60px_rgba(0,0,0,0.55)]",
          className,
        )}
        style={{ WebkitTapHighlightColor: "transparent" } as React.CSSProperties}
      >
        {children}
      </div>
    </div>
  )
}
