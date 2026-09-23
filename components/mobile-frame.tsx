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
          // Phone: locked to viewport height — inner <main> scrolls, nav stays pinned
          "relative flex h-dvh w-full flex-col overflow-hidden bg-background",
          // Tablet portrait / landscape: floating rounded card
          "sm:my-auto sm:h-[92dvh] sm:max-h-[1000px] sm:w-[640px] sm:items-stretch",
          "lg:w-[960px]",
          "sm:rounded-[2.5rem] sm:border-8 sm:border-[#0a3d2e]",
          "sm:shadow-[0_0_90px_rgba(52,211,153,0.16),0_25px_60px_rgba(0,0,0,0.55)]",
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}
