"use client"

import { useState } from "react"
import {
  ArrowLeft,
  User,
  Target,
  Bell,
  Moon,
  Sun,
  Ruler,
  Droplets,
  Footprints,
  Salad,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Check,
  Info,
  Flame,
  Download,
  Activity,
  Pencil,
} from "lucide-react"
import { useAccount, type Gender, type Goal } from "@/lib/account"
import { useSync } from "@/lib/sync"
import { useSmartNotifications } from "@/lib/notifications"
import { activityLevels } from "@/lib/nutrition-data"
import { useTheme } from "@/lib/use-theme"
import { cn } from "@/lib/utils"

type Section =
  | "root"
  | "account"
  | "body"
  | "goals"
  | "diet"
  | "allergies"
  | "preferences"
  | "privacy"

const allergies = [
  { key: "gluten", label: "Gluten", emoji: "🌾" },
  { key: "lactose", label: "Lactose", emoji: "🥛" },
  { key: "nuts", label: "Nuts", emoji: "🥜" },
  { key: "eggs", label: "Eggs", emoji: "🥚" },
  { key: "seafood", label: "Seafood", emoji: "🦐" },
  { key: "soy", label: "Soy", emoji: "🫘" },
]

const diets: { key: string; label: string; desc: string; emoji: string }[] = [
  { key: "none", label: "No restriction", desc: "I eat everything", emoji: "🍽️" },
  { key: "vegetarian", label: "Vegetarian", desc: "No meat, no fish", emoji: "🥕" },
  { key: "vegan", label: "Vegan", desc: "100% plant-based", emoji: "🌱" },
  { key: "pescatarian", label: "Pescatarian", desc: "Fish yes, meat no", emoji: "🐟" },
  { key: "halal", label: "Halal", desc: "Halal meat only", emoji: "✅" },
]

export function SettingsScreen({ onClose }: { onClose: () => void }) {
  const { state, update, targets, wipeAll } = useAccount()
  const { status } = useSync()

  const wipeEverything = async () => {
    // Server first, then local mirrors.
    if (status === "authed") {
      await fetch("/api/sync/delete-all-data", { method: "POST" }).catch(() => {})
    }
    wipeAll()
  }
  const { theme, toggle } = useTheme()
  const notif = useSmartNotifications()
  const [section, setSection] = useState<Section>("root")
  const [confirmWipe, setConfirmWipe] = useState(false)

  const titles: Record<Section, string> = {
    root: "Settings",
    account: "Account",
    body: "Body profile",
    goals: "Goals & targets",
    diet: "Diet",
    allergies: "Allergies",
    preferences: "Preferences",
    privacy: "Privacy & data",
  }

  return (
    <div className="safe-top absolute inset-0 z-30 flex flex-col bg-background animate-slide-up">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border px-4 pb-3 pt-5">
        {section !== "root" ? (
          <button
            type="button"
            onClick={() => setSection("root")}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <h1 className="text-lg font-extrabold tracking-tight">{titles[section]}</h1>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-10 pt-4">
        {section === "root" && (
          <div className="flex flex-col gap-5">
            {/* identity card */}
            <div className="flex items-center gap-4 rounded-3xl bg-card p-5 shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-lg font-extrabold text-primary">
                {(state.name || "N").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-extrabold">{state.name || "Your profile"}</p>
                <p className="truncate text-sm text-muted-foreground">{state.email || "no email"}</p>
              </div>
            </div>

            <Group title="Your profile">
              <Row icon={User} label="Account" desc="Name, email" onClick={() => setSection("account")} />
              <Row icon={Ruler} label="Body profile" desc="Age, height, weight, activity" onClick={() => setSection("body")} />
              <Row icon={Salad} label="Diet" desc={dietLabel(state)} onClick={() => setSection("diet")} />
              <Row icon={ShieldAlert} label="Allergies" desc={allergyLabel(state)} onClick={() => setSection("allergies")} />
            </Group>

            <Group title="Targets">
              <Row
                icon={Target}
                label="Daily calories"
                desc={`${targets.calories} kcal · ${targets.protein}g protein`}
                onClick={() => setSection("goals")}
              />
              <Row
                icon={Flame}
                label="BMR & TDEE"
                desc={`BMR ${targets.bmr} kcal · maintenance ${targets.tdee} kcal`}
                onClick={() => setSection("goals")}
              />
              <Row
                icon={Download}
                label="Export my data"
                desc="Download everything as JSON"
                onClick={exportData}
              />
              <Row icon={Droplets} label="Water goal" desc={`${state.waterGoal} glasses / day`} onClick={() => setSection("goals")} />
              <Row icon={Footprints} label="Steps goal" desc={`${state.stepGoal.toLocaleString()} steps / day`} onClick={() => setSection("goals")} />
            </Group>

            <Group title="App">
              <Row
                icon={theme === "dark" ? Sun : Moon}
                label="Dark mode"
                desc="Aurora night theme"
                onClick={toggle}
                trailing={<Toggle on={theme === "dark"} />}
              />
              <Row
                icon={Bell}
                label="Notifications"
                desc={
                  notif.permission === "granted"
                    ? "On — streak, goal & inactivity reminders"
                    : notif.permission === "denied"
                      ? "Blocked in browser settings"
                      : notif.permission === "unsupported"
                        ? "Not supported on this device"
                        : "Tap to allow reminders"
                }
                onClick={() => {
                  if (notif.permission !== "granted") notif.enable()
                  else update({ notifications: !state.notifications })
                }}
                trailing={
                  notif.permission === "granted" ? (
                    <Toggle on={state.notifications} />
                  ) : (
                    <span className="text-xs font-bold text-primary">Enable</span>
                  )
                }
              />
              <Row icon={ShieldCheck} label="Privacy & data" onClick={() => setSection("privacy")} />
            </Group>

            <p className="text-center text-xs text-muted-foreground">
              Sahtek v2.0.0 · your data never leaves this device
            </p>
          </div>
        )}

        {section === "account" && <AccountSection />}
        {section === "body" && <BodySection />}
        {section === "goals" && <GoalsSection />}
        {section === "diet" && (
          <ChoiceSection
            options={diets}
            selectedKey={state.diet}
            onSelect={(key) =>
              update({ diet: key as typeof state.diet })
            }
            title="Which diet do you follow?"
          />
        )}
        {section === "allergies" && <AllergiesSection />}
        {section === "privacy" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
              <p className="flex items-center gap-2 font-bold text-foreground">
                <Info className="h-4 w-4 text-primary" />
                Secure sync
              </p>
              <p className="mt-2">
                Your account, journal and history are stored in this browser <em>and</em> synced to your private,
                password-protected database (sessions expire, passwords are hashed). Deleting the app data removes
                everything permanently, here and on the server.
              </p>
            </div>
            {!confirmWipe ? (
              <button
                type="button"
                onClick={() => setConfirmWipe(true)}
                className="flex items-center justify-center gap-2 rounded-2xl border border-destructive/40 py-3.5 text-sm font-bold text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Delete all my data
              </button>
            ) : (
              <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
                <p className="text-sm font-bold text-destructive">This erases your account, journal and Premium status.</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmWipe(false)}
                    className="rounded-xl bg-muted py-2.5 text-sm font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void wipeEverything()}
                    className="rounded-xl bg-destructive py-2.5 text-sm font-bold text-[#e6fff1]"
                  >
                    Erase
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** Download every local store as one JSON file — the user owns their data. */
function exportData(): void {
  try {
    const pick = (k: string) => {
      try {
        return JSON.parse(window.localStorage.getItem(k) ?? "null")
      } catch {
        return null
      }
    }
    const payload = {
      exportedAt: new Date().toISOString(),
      app: "Sahtek",
      version: 2,
      account: pick("nourish.account.v1"),
      foodLog: pick("nourish.food-log.v1"),
      weight: pick("nourish.weight.v1"),
      health: pick("nourish.health.v1"),
      customFoods: pick("nourish.custom-foods.v1"),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `sahtek-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    // ignore
  }
}

function dietLabel(state: { diet: string }): string {
  const d = diets.find((x) => x.key === (state.diet ?? "none"))
  return d ? d.label : "No restriction"
}

function allergyLabel(state: { allergies: string[] }): string {
  const list = state.allergies
  if (list.length === 0) return "None"
  return list
    .map((k) => allergies.find((a) => a.key === k)?.label ?? k)
    .join(", ")
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
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
  desc,
  onClick,
  trailing,
}: {
  icon: typeof User
  label: string
  desc?: string
  onClick?: () => void
  trailing?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-border px-4 py-3.5 text-left last:border-b-0 active:bg-muted/50"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-primary">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        {desc && <span className="block truncate text-xs text-muted-foreground">{desc}</span>}
      </span>
      {trailing ?? <ChevronRight />}
    </button>
  )
}

function ChevronRight() {
  return <span className="text-lg text-muted-foreground">›</span>
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

function AccountSection() {
  const { state, update } = useAccount()
  const [name, setName] = useState(state.name)
  const [email, setEmail] = useState(state.email)
  const nameOk = name.trim().length >= 2
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  return (
    <div className="flex flex-col gap-5">
      <TextSetting
        label="Full name"
        value={name}
        onChange={setName}
        onSave={() => nameOk && update({ name: name.trim() })}
        ok={nameOk}
      />
      <TextSetting
        label="Email"
        value={email}
        onChange={setEmail}
        onSave={() => emailOk && update({ email: email.trim() })}
        ok={emailOk}
        type="email"
      />
      <div className="rounded-2xl bg-card p-4 text-xs text-muted-foreground">
        Signed in locally on this device. Sahtek keeps everything offline.
      </div>
    </div>
  )
}

function TextSetting({
  label,
  value,
  onChange,
  onSave,
  ok,
  type = "text",
}: {
  label: string
  value: string
  onChange: (v: string) => void
  onSave: () => void
  ok: boolean
  type?: string
}) {
  const [saved, setSaved] = useState(false)
  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm">
      <label className="block text-sm font-semibold">{label}</label>
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setSaved(false)
        }}
        type={type}
        className="mt-2 w-full rounded-xl border-2 border-border bg-background px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary"
      />
      <button
        type="button"
        onClick={() => {
          onSave()
          setSaved(true)
        }}
        disabled={!ok}
        className={cn(
          "mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground",
          !ok && "opacity-40",
        )}
      >
        {saved ? (
          <>
            <Check className="h-4 w-4" strokeWidth={3} /> Saved
          </>
        ) : (
          "Save"
        )}
      </button>
    </div>
  )
}

function BodySection() {
  const { state, update, targets } = useAccount()
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        {(["female", "male"] as Gender[]).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => update({ gender: g })}
            className={cn(
              "rounded-xl border-2 py-3 text-sm font-bold capitalize transition-all",
              state.gender === g ? "border-primary bg-accent text-foreground" : "border-border bg-card text-muted-foreground",
            )}
          >
            {g}
          </button>
        ))}
      </div>

      <Stepper label="Age" value={state.age} unit="years" min={14} max={90} step={1} onChange={(n) => update({ age: n })} />
      <Stepper label="Height" value={state.height} unit="cm" min={130} max={220} step={1} onChange={(n) => update({ height: n })} />
      <Stepper label="Current weight" value={state.weight} unit="kg" min={35} max={200} step={0.5} onChange={(n) => update({ weight: n })} />
      <Stepper
        label="Target weight"
        value={state.targetWeight}
        unit="kg"
        min={35}
        max={200}
        step={0.5}
        onChange={(n) => update({ targetWeight: n })}
      />

      <div>
        <label className="mb-2 block text-sm font-semibold">Activity level</label>
        <div className="space-y-2">
          {activityLevels.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => update({ activity: a.value })}
              className={cn(
                "flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition-all",
                state.activity === a.value ? "border-primary bg-accent" : "border-border bg-card",
              )}
            >
              <span>
                <span className="block text-sm font-bold">{a.label}</span>
                <span className="block text-xs text-muted-foreground">{a.desc}</span>
              </span>
              {state.activity === a.value && <Check className="h-5 w-5 text-primary" strokeWidth={3} />}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-secondary p-4 text-sm text-secondary-foreground">
        <p className="font-bold text-primary">Your new targets</p>
        <p className="mt-1 text-[#e6fff1]/80">
          {targets.calories} kcal/day · BMR {targets.bmr} · maintenance {targets.tdee}
        </p>
      </div>
    </div>
  )
}

function GoalsSection() {
  const { state, update, targets } = useAccount()
  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="mb-2 block text-sm font-semibold">Primary goal</label>
        <div className="space-y-2">
          {(
            [
              { key: "lose", label: "Lose weight" },
              { key: "maintain", label: "Maintain weight" },
              { key: "gain", label: "Gain muscle" },
            ] as { key: Goal; label: string }[]
          ).map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => update({ goal: g.key })}
              className={cn(
                "flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-left text-sm font-bold transition-all",
                state.goal === g.key ? "border-primary bg-accent" : "border-border bg-card",
              )}
            >
              {g.label}
              {state.goal === g.key && <Check className="h-5 w-5 text-primary" strokeWidth={3} />}
            </button>
          ))}
        </div>
      </div>

      <Stepper label="Water goal" value={state.waterGoal} unit="glasses" min={2} max={20} step={1} onChange={(n) => update({ waterGoal: n })} />
      <Stepper
        label="Steps goal"
        value={state.stepGoal}
        unit="steps"
        min={2000}
        max={30000}
        step={1000}
        onChange={(n) => update({ stepGoal: n })}
      />

      <CalorieOverrideCard />

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Calories", value: `${targets.calories}`, sub: "kcal" },
          { label: "Protein", value: `${targets.protein}`, sub: "g" },
          { label: "Carbs", value: `${targets.carbs}`, sub: "g" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-card p-3 text-center shadow-sm">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-lg font-extrabold tabular-nums text-primary">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.sub}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChoiceSection({
  options,
  selectedKey,
  onSelect,
  title,
}: {
  options: { key: string; label: string; desc: string; emoji: string }[]
  selectedKey: string
  onSelect: (key: string) => void
  title: string
}) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
      <div className="space-y-2">
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onSelect(o.key)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all",
              selectedKey === o.key ? "border-primary bg-accent" : "border-border bg-card",
            )}
          >
            <span className="text-xl">{o.emoji}</span>
            <span className="flex-1">
              <span className="block text-sm font-bold">{o.label}</span>
              <span className="block text-xs text-muted-foreground">{o.desc}</span>
            </span>
            {selectedKey === o.key && <Check className="h-5 w-5 text-primary" strokeWidth={3} />}
          </button>
        ))}
      </div>
    </div>
  )
}

function AllergiesSection() {
  const { state, update } = useAccount()
  const list = state.allergies ?? []
  const toggle = (key: string) =>
    update({ allergies: list.includes(key) ? list.filter((x) => x !== key) : [...list, key] })

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-extrabold tracking-tight">Allergies & intolerances</h2>
      <div className="grid grid-cols-2 gap-3">
        {allergies.map((a) => {
          const active = list.includes(a.key)
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => toggle(a.key)}
              className={cn(
                "flex items-center gap-2 rounded-xl border-2 px-4 py-3 text-left transition-all",
                active ? "border-primary bg-accent" : "border-border bg-card",
              )}
            >
              <span className="text-lg">{a.emoji}</span>
              <span className="flex-1 text-sm font-bold">{a.label}</span>
              {active && <Check className="h-4 w-4 text-primary" strokeWidth={3} />}
            </button>
          )
        })}
      </div>
      <p className="rounded-xl bg-card p-3 text-xs text-muted-foreground">
        Scanned foods containing these allergens will be flagged.
      </p>
    </div>
  )
}

/** Manual daily-calorie override — wins over the BMR/TDEE computation. */
function CalorieOverrideCard() {
  const { state, update, targets } = useAccount()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(state.calorieOverride ? String(state.calorieOverride) : "")
  const parsed = Number(value.replace(/\D/g, ""))
  const valid = parsed >= 800 && parsed <= 6000

  if (!editing) {
    return (
      <div className="rounded-2xl bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Calorie target</p>
            <p className="text-xs text-muted-foreground">
              {state.calorieOverride
                ? `Custom — ${state.calorieOverride} kcal / day`
                : `Auto from BMR/TDEE — ${targets.calories} kcal / day`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setValue(state.calorieOverride ? String(state.calorieOverride) : "")
              setEditing(true)
            }}
            aria-label="Edit calorie target"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-primary active:scale-90"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
        {state.calorieOverride && (
          <button
            type="button"
            onClick={() => update({ calorieOverride: null })}
            className="mt-2 text-xs font-bold text-primary"
          >
            Back to automatic ({targets.tdee > 0 ? "recommended" : "auto"})
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border-2 border-primary/40 bg-card p-4 shadow-sm">
      <p className="text-sm font-semibold">Custom calorie target</p>
      <div className="mt-2 flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
          inputMode="numeric"
          placeholder="e.g. 2000"
          className="flex-1 rounded-xl border-2 border-border bg-background px-3 py-2.5 text-sm font-bold outline-none focus:border-primary"
        />
        <span className="text-sm font-bold text-muted-foreground">kcal</span>
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="flex-1 rounded-xl bg-muted py-2.5 text-sm font-bold"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!valid}
          onClick={() => {
            update({ calorieOverride: parsed })
            setEditing(false)
          }}
          className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-40"
        >
          Save
        </button>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Activity className="h-3.5 w-3.5" />
        Auto value: {targets.bmr} BMR · {targets.tdee} maintenance
      </p>
    </div>
  )
}

function Stepper({
  label,
  value,
  unit,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  unit: string
  min: number
  max: number
  step: number
  onChange: (n: number) => void
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold">{label}</label>
      <div className="flex items-center justify-between rounded-xl border-2 border-border bg-card px-3 py-2.5">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, Math.round((value - step) * 10) / 10))}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-xl font-bold active:scale-90"
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <span className="text-lg font-bold">
          {value} <span className="text-sm font-medium text-muted-foreground">{unit}</span>
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, Math.round((value + step) * 10) / 10))}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-xl font-bold text-primary-foreground active:scale-90"
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  )
}
