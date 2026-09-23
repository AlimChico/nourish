"use client"

import {
  Calculator,
  Crown,
  Target,
  Bell,
  Moon,
  Sun,
  Ruler,
  ShieldCheck,
  ChevronRight,
  LogOut,
  Award,
  ScanLine,
} from "lucide-react"
import { usePremium, FREE_SCANS_PER_DAY } from "@/lib/premium"
import { useTheme } from "@/lib/use-theme"
import { useAccount, initialsOf } from "@/lib/account"
import { InstallGuide } from "@/components/install-guide"
import { cn } from "@/lib/utils"

const goalLabels = { lose: "Lose weight", maintain: "Maintain", gain: "Gain muscle" } as const

export function ProfileScreen({
  onOpenCalculator,
  onOpenPremium,
  onOpenSettings,
  onLogout,
}: {
  onOpenCalculator: () => void
  onOpenPremium: () => void
  onOpenSettings: () => void
  onLogout: () => void
}) {
  const { isPremium, premium, freeScansLeft, scansUsedToday } = usePremium()
  const { theme, toggle } = useTheme()
  const { state: account, targets, update } = useAccount()
  const initials = initialsOf(account.name)

  return (
    <div className="aurora-glow mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 pb-8 pt-2">
      {/* Profile header */}
      <header className="flex items-center gap-4">
        <div className="relative">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-xl font-extrabold text-primary-foreground">
            {initials}
          </div>
          {isPremium && (
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background">
              <Crown className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
        <div className="flex-1">
          <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
            {account.name || "Your profile"}
            {isPremium && (
              <span className="flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-primary-foreground">
                <Crown className="h-3 w-3" />
                Premium
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            Goal: {goalLabels[account.goal]} · {targets.calories} kcal
          </p>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-primary">
          <Award className="h-3.5 w-3.5" />
          Lvl 4
        </span>
      </header>

      {/* Premium banner / status */}
      <button
        type="button"
        onClick={onOpenPremium}
        className={cn(
          "flex items-center gap-4 rounded-3xl p-5 text-left shadow-lg transition-transform active:scale-[0.99]",
          isPremium
            ? "bg-gradient-to-br from-primary/25 to-primary/5"
            : "bg-gradient-to-br from-secondary to-[oklch(0.3_0.05_260)] text-[#e6fff1]",
        )}
      >
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
            isPremium ? "bg-primary text-primary-foreground" : "bg-primary text-primary-foreground",
          )}
        >
          <Crown className="h-6 w-6" />
        </span>
        <div className="flex-1">
          {isPremium ? (
            <>
              <p className="font-extrabold">Premium active 👑</p>
              <p className="text-sm opacity-70">
                {premium.plan === "yearly" ? "Yearly" : "Monthly"} plan · unlimited scans
              </p>
            </>
          ) : (
            <>
              <p className="font-extrabold">Go Premium</p>
              <p className="text-sm opacity-70">
                {freeScansLeft}/{FREE_SCANS_PER_DAY} free scans left today · unlock unlimited
              </p>
            </>
          )}
        </div>
        <ChevronRight className="h-5 w-5 opacity-60" />
      </button>

      {/* Usage (free tier) */}
      {!isPremium && scansUsedToday > 0 && (
        <section className="rounded-2xl bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-bold">
              <ScanLine className="h-4 w-4 text-primary" />
              Today&apos;s scans
            </span>
            <span className="text-sm font-extrabold tabular-nums">
              {scansUsedToday}/{FREE_SCANS_PER_DAY}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min((scansUsedToday / FREE_SCANS_PER_DAY) * 100, 100)}%` }}
            />
          </div>
        </section>
      )}

      {/* Install as an app — platform-aware PWA tutorial */}
      <InstallGuide />

      {/* Tools */}
      <Section title="Tools">
        <Row icon={Calculator} label="Calorie calculator" onClick={onOpenCalculator} tone="primary" />
        <Row icon={Target} label="Goals & targets" onClick={onOpenSettings} tone="carbs" />
        <Row icon={Ruler} label="Body measurements" onClick={onOpenSettings} tone="steps" />
      </Section>

      {/* Preferences */}
      <Section title="Preferences">
        <Row
          icon={Bell}
          label="Notifications"
          onClick={() => update({ notifications: !account.notifications })}
          trailing={<Toggle on={account.notifications} />}
          tone="fat"
        />
        <Row
          icon={theme === "dark" ? Sun : Moon}
          label="Dark mode"
          onClick={toggle}
          trailing={<Toggle on={theme === "dark"} />}
          tone="protein"
        />
        <Row icon={ShieldCheck} label="Settings & privacy" onClick={onOpenSettings} tone="steps" />
      </Section>

      <button
        type="button"
        onClick={onLogout}
        className="flex items-center justify-center gap-2 rounded-2xl border border-border py-3.5 text-sm font-bold text-destructive"
      >
        <LogOut className="h-4 w-4" />
        Log out
      </button>

      <p className="text-center text-xs text-muted-foreground">Sahtek v2.0.0</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-sm font-bold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="overflow-hidden rounded-2xl bg-card shadow-sm">{children}</div>
    </section>
  )
}

function Row({
  icon: Icon,
  label,
  onClick,
  trailing,
  tone,
}: {
  icon: typeof Target
  label: string
  onClick?: () => void
  trailing?: React.ReactNode
  tone: "primary" | "carbs" | "fat" | "protein" | "steps"
}) {
  const toneMap = {
    primary: "bg-accent text-primary",
    carbs: "bg-carbs-soft text-carbs",
    fat: "bg-fat-soft text-fat",
    protein: "bg-protein-soft text-protein",
    steps: "bg-steps-soft text-steps",
  }[tone]
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-border px-4 py-3.5 text-left last:border-b-0 active:bg-muted/50"
    >
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", toneMap)}>
        <Icon className="h-4.5 w-4.5" />
      </span>
      <span className="flex-1 text-sm font-semibold">{label}</span>
      {trailing ?? <ChevronRight className="h-5 w-5 text-muted-foreground" />}
    </button>
  )
}

function Toggle({ on }: { on?: boolean }) {
  return (
    <span
      className={cn(
        "flex h-6 w-10 items-center rounded-full p-0.5 transition-colors",
        on ? "bg-primary" : "bg-muted",
      )}
    >
      <span className={cn("h-5 w-5 rounded-full bg-[#e6fff1] shadow transition-transform", on && "translate-x-4")} />
    </span>
  )
}
