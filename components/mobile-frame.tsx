import { cn } from "@/lib/utils"

/**
 * App shell — responsive, safe-area aware :
 * - < 480px (téléphone, portrait & paysage) : plein écran. `.phone-shell` =
 *   100dvh avec fallback 100% pour les vieux moteurs ; padding-top égal à
 *   env(safe-area-inset-top) → aucun contenu ne passe sous la Dynamic Island,
 *   mais le FOND (bg-background) monte jusqu'à top: 0 → aucun bandeau noir.
 * - 480–1023px (tablette portrait & paysage) : carte flottante centrée, largeur
 *   fluide en min() ; les écrans réorganisent leurs grilles via les variantes sm:.
 * - ≥ 1024px (desktop) : carte ~60rem.
 * Le scroll de l'app vit dans <main> (overflow-y-auto), jamais dans le body.
 */
export function MobileFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="aurora-bg safe-x flex min-h-full justify-center">
      <div
        className={cn(
          // Phone: full-bleed at the top (le fond comble la zone Dynamic Island),
          // léger arrondi en bas uniquement.
          "phone-shell relative flex w-full flex-col overflow-hidden bg-background safe-top overscroll-none",
          "rounded-b-[1.4rem]",
          // Tablet portrait / landscape: bigger floating rounded card, fluid width
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
