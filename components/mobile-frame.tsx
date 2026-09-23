import { cn } from "@/lib/utils"

/**
 * App shell — responsive :
 * - < 640px (téléphone, portrait & paysage) : plein écran, pas de cadre.
 * - 640–1023px (tablette portrait) : carte centrée ~640px, arrondie.
 * - ≥ 1024px (tablette paysage / desktop) : carte centrée ~960px.
 */
export function MobileFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="flex min-h-dvh justify-center aurora-bg">        <div
        className={cn(
          // Phone: locked to viewport height — full-bleed at the top, slight
          // rounding at the bottom only (no dark wedges around the notch area)
          "relative flex h-dvh w-full flex-col overflow-hidden bg-background",
          "rounded-b-[1.4rem]",
          // Tablet portrait / landscape: floating rounded card
          "sm:my-auto sm:h-[92dvh] sm:max-h-[1000px] sm:w-[640px] sm:items-stretch",
          "lg:w-[960px]",
          "sm:rounded-[2.5rem]",
          "sm:shadow-[0_25px_60px_rgba(0,0,0,0.55)]",
          className,
        )}
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        {children}
      </div>
    </div>
  )
}
