import { cn } from "@/lib/utils"

/**
 * App shell — responsive, safe-area aware :
 * - < 480px (téléphone) : plein écran. Le wrapper est h-full (et pas min-h-full) :
 *   c'est ce qui complète la chaîne html 100% → body 100% → wrapper 100% →
 *   shell 100%/100svh — sans elle, le shell n'a pas de hauteur bornée et le
 *   scroll interne meurt (bug « impossible de scroller jusqu'en bas »).
 *   `.phone-shell` = hauteur CONSTANTE (svh) → la barre de navigation ancrée
 *   au shell ne bouge jamais, même quand la barre d'URL Safari se cache.
 *   safe-top protège le contenu de la Dynamic Island ; le FOND monte à top: 0.
 * - 480–1023px (tablette) : carte flottante centrée (94dvh).
 * - ≥ 1024px (desktop) : carte ~60rem.
 * Le scroll de l'app vit dans <main> (overflow-y-auto), jamais dans le body.
 */
export function MobileFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="aurora-bg safe-x flex h-full justify-center">
      <div
        className={cn(
          "phone-shell relative flex w-full flex-col overflow-hidden bg-background safe-top overscroll-none",
          "rounded-b-[1.4rem]",
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
