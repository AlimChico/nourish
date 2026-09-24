import { cn } from "@/lib/utils"

/**
 * App shell — responsive, safe-area aware :
 * - < 480px (téléphone, portrait & paysage) : plein écran, padding-top égal à
 *   env(safe-area-inset-top) → aucun contenu (ni l'aurora-glow pleine hauteur)
 *   ne passe derrière la barre de statut (heure/wifi/batterie).
 * - 480–1023px (tablette portrait & paysage) : carte flottante centrée, largeur
 *   fluide en min() (jamais de px fixes) — pas juste le layout mobile étiré :
 *   les écrans réorganisent leurs grilles via --content-w / --col-w.
 * - ≥ 1024px (desktop) : carte ~56rem.
 */
export function MobileFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="aurora-bg flex min-h-dvh justify-center">
      <div
        className={cn(
          // Phone: locked to viewport height — full-bleed at the top, slight
          // rounding at the bottom only (no dark wedges around the notch area)
          "relative flex h-dvh w-full flex-col overflow-hidden bg-background safe-top",
          "rounded-b-[1.4rem]",
          // Tablet portrait / landscape: floating rounded card, fluid width
          "sm:my-auto sm:h-[92dvh] sm:max-h-[62.5rem] sm:w-[min(100vw-2rem,44rem)] sm:items-stretch sm:rounded-[2.5rem]",
          "lg:w-[min(92vw,60rem)]",
          "sm:shadow-[0_25px_60px_rgba(0,0,0,0.55)]",
          className,
        )}
        style={
          {
            WebkitTapHighlightColor: "transparent",
            // Largeur de contenu pour les écrans : mobile = fluide, tablette = 2 colonnes
            ["--content-w" as string]: "min(100vw-2rem,44rem)",
            ["--col-w" as string]: "min(45vw,21rem)",
          } as React.CSSProperties
        }
      >
        {children}
      </div>
    </div>
  )
}
