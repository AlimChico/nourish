import { cn } from "@/lib/utils"

/**
 * App shell — responsive, safe-area aware, et SANS aucune dépendance aux unités
 * de hauteur (vh/dvh/svh/%) sur téléphone : c'est la source n°1 de bugs scroll
 * sur Safari iOS et les vieux moteurs. Pattern inratable :
 *
 *   .app-viewport { position: fixed; inset: 0 }   ← ancré à la fenêtre, toujours
 *
 * - Le WRAPPER couvre toute la fenêtre (fond aurora) — rien ne dépasse jamais.
 * - Le SHELL phone (< 480px) remplit le wrapper (h-full d'un parent fixed =
 *   hauteur garantie), SANS aucun coin arrondi : le fond va jusqu'au bord bas
 *   de l'écran (sous le home indicator) → aucune bande sombre dans les coins.
 * - La barre de navigation (fixed, même pattern) est donc stable à vie, et le
 *   scroll vit UNIQUEMENT dans <main> (overflow-y:auto + min-height:0).
 * - Tablette (≥ 480px) : le viewport redevient statique et la carte flottante
 *   utilise sm:phone-shell (94dvh avec fallback 94%, voir globals.css) avec,
 *   seulement là, des coins arrondis.
 * - `aurora-glow` est posé ICI et nulle part ailleurs : un seul halo continu,
 *   de la barre de statut au home indicator → plus de bande noire en haut/bas.
 */
export function MobileFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="app-viewport aurora-bg safe-x justify-center">
      <div
        className={cn(
          // aurora-glow sur TOUT le shell (y compris la zone safe-top) : le fond
          // est continu de la barre de statut jusqu'au home indicator — plus de
          // bande noire entre la barre de statut et le contenu.
          "relative mx-auto flex h-full w-full flex-col overflow-hidden bg-background aurora-glow safe-top overscroll-none",
          "sm:phone-shell sm:my-auto sm:max-h-[68rem] sm:w-[min(100vw-2.5rem,52rem)] sm:items-stretch sm:rounded-[2.5rem]",
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
