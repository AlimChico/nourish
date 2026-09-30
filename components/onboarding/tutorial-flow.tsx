"use client"

import { useRef, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Search,
  Barcode,
  Flame,
  Droplets,
  Dumbbell,
  Trophy,
  Sparkles,
  Check,
  Footprints,
  CircleDot,
} from "lucide-react"
import { XP_PER_ENTRY, FULL_DAY_BONUS, STREAK_XP_PER_DAY, MAX_DAILY_XP } from "@/lib/xp"
import { cn } from "@/lib/utils"

/**
 * Parcours d'introduction (5 écrans) montré après la création de compte, avant
 * le dashboard — et rejouable depuis le profil (« Revoir le tutoriel »).
 *
 * Chaque écran répond à UNE question que se pose un nouvel utilisateur, avec
 * une maquette de l'interface réelle : on ne décrit pas l'app, on la montre.
 */

export function TutorialFlow({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const total = SCREENS.length
  const touchX = useRef<number | null>(null)

  const next = () => (step < total - 1 ? setStep(step + 1) : onDone())
  const back = () => setStep((s) => Math.max(0, s - 1))

  return (
    <div
      className="safe-top absolute inset-0 z-50 flex flex-col bg-background aurora-glow animate-fade-in sm:mx-auto sm:max-w-2xl sm:border-x sm:border-[#a7f3d0]/10 sm:shadow-2xl"
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX
      }}
      onTouchEnd={(e) => {
        const start = touchX.current
        touchX.current = null
        if (start === null) return
        const dx = e.changedTouches[0].clientX - start
        if (Math.abs(dx) < 60) return
        if (dx < 0) next()
        else back()
      }}
    >
      {/* En-tête : progression + passer */}
      <div className="flex items-center gap-3 px-5 pb-2 pt-3 sm:px-6">
        {step > 0 ? (
          <button
            type="button"
            onClick={back}
            aria-label="Écran précédent"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="h-4.5 w-4.5" />
          </span>
        )}
        <div className="flex flex-1 gap-1.5" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={total}>
          {SCREENS.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStep(i)}
              aria-label={`Écran ${i + 1} : ${s.title}`}
              className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= step ? "bg-primary" : "bg-muted")}
            />
          ))}
        </div>
        {/* « Passer » est présent dès le 1er écran : personne n'est bloqué. */}
        <button
          type="button"
          onClick={onDone}
          className="rounded-full bg-muted px-3 py-1.5 text-xs font-bold text-muted-foreground"
        >
          Skip
        </button>
      </div>

      {/* Contenu de l'écran */}
      <div key={SCREENS[step]!.key} className="flex min-h-0 flex-1 flex-col overflow-y-auto no-scrollbar px-5 pb-4 sm:px-6">
        {SCREENS[step]!.render()}
      </div>

      {/* Pied : compteur + action */}
      <div className="flex items-center gap-3 px-5 pb-6 pt-2 sm:px-6">
        <span className="text-xs font-bold tabular-nums text-muted-foreground">
          {step + 1} / {total}
        </span>
        <button
          type="button"
          onClick={next}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-[0.98]"
        >
          {step === total - 1 ? "Start tracking" : "Next"}
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}

/* ────────────────────────────── Les 5 écrans ────────────────────────────── */

function ScreenShell({
  icon,
  emoji,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode
  emoji: string
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-1 flex-col animate-slide-up pt-3">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-primary">{icon}</span>
      <h1 className="mt-4 text-balance text-3xl font-extrabold leading-tight tracking-tight">
        {title} <span aria-hidden>{emoji}</span>
      </h1>
      <p className="mt-2 text-pretty text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
      <div className="mt-5">{children}</div>
    </div>
  )
}

/** Petite ligne « puce » réutilisée partout dans le parcours. */
function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm leading-snug">
      <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Check className="h-3 w-3" strokeWidth={3.5} />
      </span>
      <span className="text-muted-foreground">{children}</span>
    </li>
  )
}

function LogMealScreen() {
  const cards = [
    { icon: <Camera className="h-5 w-5" />, title: "Scan a photo", desc: "Point at the plate — lablabi, kosksi, brik…", tone: "bg-primary text-primary-foreground" },
    { icon: <Search className="h-5 w-5" />, title: "Search", desc: "71 Tunisian dishes + your own foods", tone: "bg-accent text-primary" },
    { icon: <Barcode className="h-5 w-5" />, title: "Scan a barcode", desc: "Packaged products from the shelf", tone: "bg-accent text-primary" },
  ]
  return (
    <ScreenShell
      icon={<Camera className="h-6 w-6" />}
      emoji="📷"
      title="Log a meal in seconds"
      subtitle="Three ways to add food — pick whichever is fastest right now. No weighing, no spreadsheet."
    >
      <div className="space-y-2.5">
        {cards.map((c) => (
          <div key={c.title} className="flex items-center gap-3 rounded-2xl border border-[#a7f3d0]/10 bg-card p-3.5">
            <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", c.tone)}>{c.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold">{c.title}</span>
              <span className="block text-xs leading-snug text-muted-foreground">{c.desc}</span>
            </span>
          </div>
        ))}
      </div>
      <ul className="mt-4 space-y-2.5">
        <Bullet>The floating scan button is always on the home screen — one tap from anywhere.</Bullet>
        <Bullet>If the scanner is unavailable, Sahtek says it clearly instead of inventing a result.</Bullet>
        <Bullet>Forgot to log? Add it to the right meal: breakfast, lunch, dinner or snacks.</Bullet>
      </ul>
    </ScreenShell>
  )
}

function TargetsScreen() {
  return (
    <ScreenShell
      icon={<CircleDot className="h-6 w-6" />}
      emoji="🎯"
      title="Calories & macros, no maths"
      subtitle="Sahtek computes your daily target from your body and your goal, then subtracts what you eat as the day goes."
    >
      {/* Maquette du cercle « Remaining » */}
      <div className="surface-dark flex items-center gap-4 rounded-3xl border border-[#a7f3d0]/10 bg-gradient-to-b from-[#11251b] to-[#0d1a13] p-4">
        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-[#0a1410] ring-4 ring-primary/70">
          <div className="text-center">
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Remaining</p>
            <p className="text-xl font-extrabold tabular-nums text-primary">1 110</p>
            <p className="text-[9px] font-semibold text-muted-foreground">kcal</p>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          {[
            { label: "Protein", value: 60, tone: "bg-protein" },
            { label: "Carbs", value: 120, tone: "bg-carbs" },
            { label: "Fat", value: 40, tone: "bg-fat" },
          ].map((m) => (
            <div key={m.label}>
              <div className="flex items-baseline justify-between text-[11px] font-semibold">
                <span className="text-muted-foreground">{m.label}</span>
                <span className="tabular-nums">{m.value} g</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", m.tone)} style={{ width: `${Math.min(100, 40 + m.value / 3)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <ul className="mt-4 space-y-2.5">
        <Bullet>
          <b className="text-foreground">Remaining</b> = your target minus what you already ate. Log a meal and the
          circle updates instantly.
        </Bullet>
        <Bullet>Macros are guidance, not a limit: protein, carbs and fat show how balanced the day is.</Bullet>
        <Bullet>You can change your target any time in Settings → Daily calories.</Bullet>
      </ul>
    </ScreenShell>
  )
}

function HabitsScreen() {
  const days = ["M", "T", "W", "T", "F", "S", "S"]
  const done = [true, true, true, true, false, false, false]
  return (
    <ScreenShell
      icon={<Flame className="h-6 w-6" />}
      emoji="🔥"
      title="Streak, water & workouts"
      subtitle="Three small daily habits turn the app into progress: log something, drink, move."
    >
      {/* Maquette du bloc « streak » */}
      <div className="rounded-3xl border border-[#a7f3d0]/10 bg-card p-4">
        <p className="flex items-center gap-1.5 text-sm font-extrabold">
          <Flame className="h-4 w-4 text-fat" /> 4 day streak
        </p>
        <div className="mt-3 flex items-start justify-between px-0.5">
          {days.map((d, i) => (
            <div key={`${d}-${i}`} className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full",
                  done[i] ? "bg-primary text-primary-foreground" : "border border-dashed border-border text-transparent",
                  i === 3 && "ring-2 ring-primary/40 ring-offset-2 ring-offset-card",
                )}
              >
                {done[i] ? <Check className="h-4 w-4" strokeWidth={3.5} /> : <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />}
              </span>
              <span className={cn("text-[10px] font-bold", i === 3 ? "text-primary" : "text-muted-foreground")}>{d}</span>
            </div>
          ))}
        </div>
        <div className="my-3.5 h-px bg-border" />
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Droplets className="h-4 w-4 text-steps" /> Water 3/8
          <span className="mx-1 h-1 w-1 rounded-full bg-border" />
          <Dumbbell className="h-4 w-4 text-primary" /> Workout 15 min
          <span className="mx-1 h-1 w-1 rounded-full bg-border" />
          <Footprints className="h-4 w-4 text-steps" /> 6 200 steps
        </div>
      </div>
      <ul className="mt-4 space-y-2.5">
        <Bullet>
          The streak counts consecutive days with <b className="text-foreground">at least one meal logged</b> — or a
          genuinely active day (3 000+ steps). It resets at midnight, Tunisian time.
        </Bullet>
        <Bullet>The +/− water buttons stop at your goal: impossible to go over, impossible to go below 0.</Bullet>
        <Bullet>Workout and steps subtract from your day (net calories) — moving leaves room on the plate.</Bullet>
      </ul>
    </ScreenShell>
  )
}

function XpScreen() {
  return (
    <ScreenShell
      icon={<Trophy className="h-6 w-6" />}
      emoji="🏆"
      title="Earn XP, climb the levels"
      subtitle="Every logged food earns points, a maintained streak earns more — and the leaderboard shows where you stand."
    >
      {/* Maquette de la carte de niveau */}
      <div className="rounded-3xl border border-[#a7f3d0]/10 bg-card p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[#0f766e] text-lg font-extrabold text-primary-foreground">
            3
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-extrabold">
                Level 3 <span className="ml-1 font-bold text-muted-foreground">Assidu</span>
              </p>
              <span className="text-xs font-extrabold tabular-nums text-primary">315 XP</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-primary to-[#a7f3d0]" />
            </div>
            <p className="mt-1.5 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
              <span className="tabular-nums">115 / 200 XP → level 4</span>
              <span className="tabular-nums text-primary">+50 today</span>
            </p>
          </div>
        </div>
        <div className="surface-dark mt-3 flex items-center justify-between rounded-2xl bg-[#0a1410]/70 px-3 py-2 text-xs font-semibold">
          <span className="text-muted-foreground">Leaderboard</span>
          <span className="font-extrabold text-primary">🥇 🥈 🥉 · your rank</span>
        </div>
      </div>
      <ul className="mt-4 space-y-2.5">
        <Bullet>+{XP_PER_ENTRY} XP per food logged (10 foods a day are counted — no point spamming).</Bullet>
        <Bullet>+{FULL_DAY_BONUS} XP bonus for a complete day (3 foods or more), +{STREAK_XP_PER_DAY} XP per streak day.</Bullet>
        <Bullet>
          Maximum {MAX_DAILY_XP} XP a day. Your level and progress bar live on the dashboard, the full ranking in
          Settings → Leaderboard.
        </Bullet>
      </ul>
    </ScreenShell>
  )
}

function DashboardScreen() {
  const rows = [
    { emoji: "🎯", title: "Remaining circle", desc: "kcal left today + water and workout goals, all in one card" },
    { emoji: "📷", title: "Add food", desc: "the big green button — scan, search or barcode" },
    { emoji: "🏆", title: "Level & XP", desc: "your progress bar, tap it to open the leaderboard" },
    { emoji: "🔥", title: "Streak & macros", desc: "this week at a glance, plus protein / carbs / fat" },
    { emoji: "🍽️", title: "Today's meals", desc: "one block for all four meals — tap a row to edit or delete it" },
    { emoji: "👟", title: "Bottom tabs", desc: "Food, Progress, Workout, Profile — swipe sideways to switch" },
  ]
  return (
    <ScreenShell
      icon={<Sparkles className="h-6 w-6" />}
      emoji="👋"
      title="Reading your dashboard"
      subtitle="Everything you need is on one screen. Here's the map — you're ready to start."
    >
      {/* Compact : les 6 repères + le rappel doivent tenir sur un iPhone SE sans
          scroll — c'est le dernier écran, il doit se lire d'un coup d'œil. */}
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.title} className="flex items-center gap-2.5 rounded-2xl border border-[#a7f3d0]/10 bg-card p-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-sm" aria-hidden>
              {r.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-extrabold leading-tight">{r.title}</span>
              <span className="block text-[11px] leading-snug text-muted-foreground">{r.desc}</span>
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 rounded-2xl bg-accent p-3 text-[11px] font-semibold text-accent-foreground">
        You can replay this tour anytime from <b>Profile → Revoir le tutoriel</b>.
      </p>
    </ScreenShell>
  )
}

const SCREENS: { key: string; title: string; render: () => React.ReactNode }[] = [
  { key: "log", title: "Log a meal in seconds", render: () => <LogMealScreen /> },
  { key: "targets", title: "Calories & macros", render: () => <TargetsScreen /> },
  { key: "habits", title: "Streak, water & workouts", render: () => <HabitsScreen /> },
  { key: "xp", title: "XP & levels", render: () => <XpScreen /> },
  { key: "dashboard", title: "Reading your dashboard", render: () => <DashboardScreen /> },
]
