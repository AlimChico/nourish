"use client"

import { useState } from "react"
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
  Users,
  BookOpen,
  CalendarDays,
} from "lucide-react"
import { usePremium, FREE_SCANS_PER_DAY } from "@/lib/premium"
import { useTheme } from "@/lib/use-theme"
import { useAccount, initialsOf } from "@/lib/account"
import { InstallGuide } from "@/components/install-guide"
import { useXp } from "@/components/use-xp"
import { useWeight } from "@/lib/weight"
import { useStreak } from "@/components/use-streak"
import { nativeShare } from "@/lib/share"
import { Share2 } from "lucide-react"
import { barWidth, cn } from "@/lib/utils"

const goalLabels = { lose: "Lose weight", maintain: "Maintain", gain: "Gain muscle" } as const

export function ProfileScreen({
  onOpenCalculator,
  onOpenPremium,
  onOpenSettings,
  onOpenCommunity,
  onOpenTutorial,
  onOpenHistory,
  onOpenProgress,
  onLogout,
}: {
  onOpenCalculator: () => void
  onOpenPremium: () => void
  onOpenSettings: () => void
  onOpenCommunity: () => void
  /** Rejoue le parcours d'introduction (les 5 écrans du premier lancement). */
  onOpenTutorial?: () => void
  /** Ouvre l'historique des repas (jours passés). */
  onOpenHistory?: () => void
  /** Bascule sur l'onglet Progress (poids & courbes). */
  onOpenProgress?: () => void
  onLogout: () => void
}) {
  const { isPremium, premium, freeScansLeft, scansUsedToday } = usePremium()
  const { theme, toggle } = useTheme()
  const { state: account, targets, update } = useAccount()
  const xp = useXp()
  const weight = useWeight()
  const streak = useStreak()
  const initials = initialsOf(account.name)

  /**
   * Parcours du poids : du premier poids enregistré vers l'objectif. Sans
   * historique on retombe sur le poids du profil, pour ne jamais afficher un
   * chiffre inventé ni une barre vide sans explication.
   */
  const journey = (() => {
    const series = [...weight.entries].reverse()
    const start = series[0]?.kg ?? account.weight
    const current = weight.latest?.kg ?? account.weight
    const target = account.targetWeight
    const span = start - target
    const done = start - current
    const pct = Math.abs(span) < 0.1 ? 100 : Math.max(0, Math.min(100, Math.round((done / span) * 100)))
    return {
      start,
      current,
      target,
      toGo: Math.round((current - target) * 10) / 10,
      since: series.length > 1 ? Math.round((current - start) * 10) / 10 : null,
      pct,
      weighIns: series.length,
    }
  })()

  return (
    <div className="mx-auto flex w-full flex-col gap-6 px-5 pb-8 pt-2 sm:px-6">
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
        {/* Niveau réel (barème XP), plus de valeur en dur. */}
        <span
          className="flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-primary"
          title={`${xp.totalXp.toLocaleString()} XP · ${xp.level.title}`}
        >
          <Award className="h-3.5 w-3.5" />
          Lvl {xp.level.level}
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
              style={{ width: barWidth((scansUsedToday / FREE_SCANS_PER_DAY) * 100) }}
            />
          </div>
        </section>
      )}

      {/* Corps & progression : résumé du poids + habitudes, avec les accès directs */}
      <Section title="Body & progress">
        <div className="px-4 py-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Current</p>
              <p className="text-2xl font-extrabold tabular-nums">
                {journey.current}
                <span className="ml-1 text-sm font-bold text-muted-foreground">kg</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Target</p>
              <p className="text-2xl font-extrabold tabular-nums text-primary">
                {journey.target}
                <span className="ml-1 text-sm font-bold text-muted-foreground">kg</span>
              </p>
            </div>
          </div>
          {/* Barre toujours visible, même à 0 % (#44) */}
          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-[#a7f3d0] transition-[width] duration-700"
              style={{ width: barWidth(journey.pct) }}
            />
          </div>
          <p className="mt-1.5 text-[11px] font-semibold text-muted-foreground">
            {journey.pct}% of the way · {Math.abs(journey.toGo)} kg {journey.toGo > 0 ? "to lose" : journey.toGo < 0 ? "to gain" : "— goal reached 🎉"}
            {journey.since !== null && ` · ${journey.since > 0 ? "+" : ""}${journey.since} kg since your first weigh-in`}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
          <MiniStat label="Streak" value={`${streak}d`} emoji="🔥" />
          <MiniStat label="Days logged" value={String(xp.daysTracked)} emoji="📅" />
          <MiniStat label="Weigh-ins" value={String(journey.weighIns)} emoji="⚖️" />
          <MiniStat label="Level" value={String(xp.level.level)} emoji="🏆" />
        </div>
      </Section>

      {/* Install as an app — platform-aware PWA tutorial */}
      <InstallGuide />

      {/* Partager l'app — lien /share avec landing dédiée */}
      <ShareAppCard />

      {/* Tools */}
      <Section title="Tools">
        <Row icon={Calculator} label="Calorie calculator" onClick={onOpenCalculator} tone="primary" />
        <Row icon={Users} label="Communauté — défis & recettes" onClick={onOpenCommunity} tone="primary" />
        <Row icon={Target} label="Goals & targets" onClick={onOpenSettings} tone="carbs" />
        <Row
          icon={Ruler}
          label="Body measurements & weight"
          onClick={onOpenProgress ?? onOpenSettings}
          tone="steps"
        />
        <Row icon={CalendarDays} label="Meal history" onClick={onOpenHistory} tone="protein" />
        <Row icon={BookOpen} label="Revoir le tutoriel" onClick={onOpenTutorial} tone="fat" />
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

/** Carte de partage : lien /share (landing avec install + création de compte). */
function ShareAppCard() {
  const [done, setDone] = useState<"shared" | "copied" | "cancelled" | null>(null)
  const share = async () => {
    const link = `${window.location.origin}/share?kind=app`
    const r = await nativeShare({
      title: "Sahtek — Ton coach nutrition tunisien 🇹🇳",
      text: "Je suis mes calories avec Sahtek : scan des plats tunisiens, coach en derja, défis entre amis 💪 Rejoins-moi !",
      url: link,
    })
    setDone(r)
    window.setTimeout(() => setDone(null), 2000)
  }
  return (
    <button
      type="button"
      onClick={() => void share()}
      className="flex w-full items-center gap-4 rounded-3xl border border-[#a7f3d0]/15 bg-card p-4 text-left shadow-sm transition-transform active:scale-[0.99]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-xl">🎁</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold">{done === "copied" ? "Lien copié — colle-le où tu veux !" : done === "shared" ? "Partagé, merci 💚" : "Invite un ami"}</span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
          Envoie le lien Sahtek — tes amis arrivent sur une page qui explique l'app et créent leur programme en 2 min.
        </span>
      </span>
      <Share2 className="h-5 w-5 shrink-0 text-primary" />
    </button>
  )
}

/** Petite statistique alignée (emoji + valeur + libellé). */
function MiniStat({ label, value, emoji }: { label: string; value: string; emoji: string }) {
  return (
    <div className="min-w-0 flex-1 text-center">
      <p className="text-sm font-extrabold tabular-nums">
        <span aria-hidden className="mr-0.5">
          {emoji}
        </span>
        {value}
      </p>
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
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
