import { cn } from "@/lib/utils"

export function MobileFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="flex min-h-dvh justify-center aurora-bg sm:items-center sm:p-6">
      <div
        className={cn(
          "relative flex min-h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-background sm:min-h-0 sm:h-[900px] sm:max-h-[92dvh] sm:rounded-[2.75rem] sm:border-8 sm:border-[#0a3d2e] sm:shadow-[0_0_90px_rgba(52,211,153,0.16),0_25px_60px_rgba(0,0,0,0.55)]",
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}
