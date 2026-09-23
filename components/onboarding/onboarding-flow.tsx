"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import {
  ArrowRight,
  ArrowLeft,
  Leaf,
  TrendingDown,
  Minus,
  Dumbbell,
  Check,
  Sparkles,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Salad,
  ShieldAlert,
  Utensils,
  Flame,
  Droplets,
  Footprints,
  PartyPopper,
} from "lucide-react"
import { AnimatedCounter } from "@/components/animated-counter"
import { activityLevels, calcNutrition } from "@/lib/nutrition-data"
import { useAccount, type Gender, type Goal, type OnboardingData } from "@/lib/account"
import { useSync } from "@/lib/sync"
import { useFoodLog } from "@/lib/food-log"
import { useSmartNotifications } from "@/lib/notifications"
import { cn } from "@/lib/utils"

const STEPS = 11 // 0..10

type Diet = "none" | "vegetarian" | "vegan" | "pescatarian" | "halal"
const diets: { key: Diet; label: string; desc: string; emoji: string }[] = [
  { key: "none", label: "No restriction", desc: "I eat everything", emoji: "🍽️" },
  { key: "vegetarian", label: "Vegetarian", desc: "No meat, no fish", emoji: "🥕" },
  { key: "vegan", label: "Vegan", desc: "100% plant-based", emoji: "🌱" },
  { key: "pescatarian", label: "Pescatarian", desc: "Fish yes, meat no", emoji: "🐟" },
  { key: "halal", label: "Halal", desc: "Halal meat only", emoji: "✅" },
]

const allergies = [
  { key: "gluten", label: "Gluten", emoji: "🌾" },
  { key: "lactose", label: "Lactose", emoji: "🥛" },
  { key: "nuts", label: "Nuts", emoji: "🥜" },
  { key: "eggs", label: "Eggs", emoji: "🥚" },
  { key: "seafood", label: "Seafood", emoji: "🦐" },
  { key: "soy", label: "Soy", emoji: "🫘" },
]

const mealsPerDayOptions = [3, 4, 5]

const goals: { key: Goal; label: string; desc: string; icon: typeof TrendingDown }[] = [
  { key: "lose", label: "Lose weight", desc: "Burn fat & feel lighter", icon: TrendingDown },
  { key: "maintain", label: "Maintain weight", desc: "Stay balanced & healthy", icon: Minus },
  { key: "gain", label: "Gain muscle", desc: "Build strength & mass", icon: Dumbbell },
]

export function OnboardingFlow() {
  const { state: saved, update, markOnboarded } = useAccount()
  const { resetDay } = useFoodLog()
  const { signup, login, user } = useSync()
  const [step, setStep] = useState(0)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  // "I already have an account" → dedicated login form instead of silently skipping.
  const [loginMode, setLoginMode] = useState(false)
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")

  // Account
  const [name, setName] = useState(saved.name)
  const [email, setEmail] = useState(saved.email)
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  // Body & goals
  const [goal, setGoal] = useState<Goal>(saved.goal)
  const [gender, setGender] = useState<Gender>(saved.gender)
  const [age, setAge] = useState(saved.age)
  const [height, setHeight] = useState(saved.height)
  const [weight, setWeight] = useState(saved.weight)
  const [targetWeight, setTargetWeight] = useState(saved.targetWeight)
  const [activity, setActivity] = useState(saved.activity)

  // Lifestyle
  const [diet, setDiet] = useState<Diet>(saved.diet)
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>(saved.allergies)
  const [mealsPerDay, setMealsPerDay] = useState(4)
  const [waterGoal, setWaterGoal] = useState(saved.waterGoal)
  const [stepGoal, setStepGoal] = useState(saved.stepGoal)

  const nameOk = name.trim().length >= 2
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const passOk = password.length >= 6
  const accountOk = nameOk && emailOk && passOk

  const result = useMemo(
    () => calcNutrition({ gender, age, height, weight, activity, goal }),
    [gender, age, height, weight, activity, goal],
  )

  const next = () => setStep((s) => Math.min(s + 1, STEPS - 2)) // step 10 is the celebration
  const back = () => setStep((s) => Math.max(s - 1, 0))

  /** Log in to an existing account: pull its data from the server, then open the app. */
  const signInExisting = async () => {
    if (authBusy) return
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail)
    if (!emailOk || loginPassword.length < 8) {
      setAuthError("Enter a valid email and your password (8+ characters).")
      return
    }
    setAuthBusy(true)
    setAuthError(null)
    const r = await login(loginEmail.trim(), loginPassword)
    if (!r.ok) {
      setAuthBusy(false)
      setAuthError(r.error === "network" ? "Server unreachable — try again." : r.error ?? "Login failed")
      return
    }
    // markOnboarded opens the dashboard; the account store restores the cloud profile.
    markOnboarded()
    setAuthBusy(false)
  }

  const buildData = (): OnboardingData => ({
    name: name.trim(),
    email: email.trim(),
    gender,
    age,
    height,
    weight,
    targetWeight: goal === "maintain" ? weight : targetWeight,
    activity,
    goal,
    units: "metric",
    waterGoal,
    stepGoal,
    calorieOverride: null,
    notifications: true,
    diet,
    allergies: selectedAllergies,
  })

  /** Save everything the user entered, create the server account, reset the journal, then celebrate. */
  const createAccount = async () => {
    if (!accountOk || authBusy) return
    setAuthBusy(true)
    setAuthError(null)
    // Create the real server account (SQLite); fall back to local-only if unavailable.
    let serverOk = true
    if (!user) {
      const r = await signup(name.trim(), email.trim(), password)
      if (!r.ok) {
        // Already an account? Try signing in — the profile data still syncs.
        const retry = await login(email.trim(), password)
        if (!retry.ok) {
          setAuthBusy(false)
          setAuthError(r.error === "network" ? "Server unreachable — account kept on this device only." : r.error ?? "Signup failed")
          return
        }
      }
    }
    serverOk = true
    update(buildData()) // persisted — onboarded stays false until the celebration ends
    resetDay() // calorie counter starts at 0 on the new account's day one
    try {
      // A brand-new account starts with a truly clean slate.
      window.localStorage.setItem(
        "nourish.health.v1",
        JSON.stringify({ days: {} }),
      )
      window.localStorage.removeItem("nourish.premium.v1")
      for (const k of Object.keys(window.localStorage)) {
        if (k.startsWith("nourish.nudge.")) window.localStorage.removeItem(k)
      }
    } catch {
      // storage unavailable
    }
    setAuthBusy(false)
    setStep(STEPS - 1)
    if (serverOk && navigator.onLine) void fetch("/api/sync/account", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ account: { ...buildData(), onboarded: false } }),
    })
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background sm:min-h-0 sm:flex-1">
      {step <= STEPS - 2 && (
        <div className="flex items-center gap-3 px-6 pb-2 pt-3">
          {step > 0 && (
            <button
              type="button"
              onClick={back}
              aria-label="Back"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="flex flex-1 gap-1.5">
            {Array.from({ length: STEPS - 1 }, (_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  i <= step ? "bg-primary" : "bg-muted",
                )}
              />
            ))}
          </div>
          <span className="text-xs font-bold tabular-nums text-muted-foreground">
            {step + 1}/{STEPS - 1}
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-6 pb-8">
        {step === 0 && !loginMode && <WelcomeStep />}
        {step === 0 && loginMode && (
          <LoginStep
            email={loginEmail}
            setEmail={setLoginEmail}
            password={loginPassword}
            setPassword={setLoginPassword}
            onBack={() => {
              setLoginMode(false)
              setAuthError(null)
            }}
            onSubmit={signInExisting}
            busy={authBusy}
            error={authError}
          />
        )}
        {step === 1 && <GoalStep goal={goal} setGoal={setGoal} />}
        {step === 2 && (
          <StatsStep
            gender={gender}
            setGender={setGender}
            age={age}
            setAge={setAge}
            height={height}
            setHeight={setHeight}
            weight={weight}
            setWeight={setWeight}
          />
        )}
        {step === 3 && (
          <TargetWeightStep
            goal={goal}
            weight={weight}
            targetWeight={targetWeight}
            setTargetWeight={(n) => setTargetWeight(Math.round(n * 10) / 10)}
          />
        )}
        {step === 4 && <ActivityStep activity={activity} setActivity={setActivity} />}
        {step === 5 && <DietStep diet={diet} setDiet={setDiet} />}
        {step === 6 && (
          <AllergiesStep
            selected={selectedAllergies}
            toggle={(k) =>
              setSelectedAllergies((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]))
            }
          />
        )}
        {step === 7 && (
          <HabitsStep
            mealsPerDay={mealsPerDay}
            setMealsPerDay={setMealsPerDay}
            waterGoal={waterGoal}
            setWaterGoal={setWaterGoal}
            stepGoal={stepGoal}
            setStepGoal={setStepGoal}
          />
        )}
        {step === 8 && <ProgramStep result={result} goal={goal} mealsPerDay={mealsPerDay} name={name} />}
        {step === 9 && (
          <AccountStep
            name={name}
            setName={setName}
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            nameOk={nameOk}
            emailOk={emailOk}
            passOk={passOk}
          />
        )}
        {step === 10 && (
          <NotificationsStep
            onEnter={markOnboarded}
            name={name}
          />
        )}
      </div>

      {step <= 9 && (
        <div className="px-6 pb-8 pt-2">
          {step === 0 && loginMode && (
            <button
              type="button"
              onClick={signInExisting}
              disabled={authBusy}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-[0.98]"
            >
              {authBusy ? "Signing in…" : "Log in"}
              <ArrowRight className="h-5 w-5" />
            </button>
          )}
          {!(step === 0 && loginMode) && (
          <button
            type="button"
            onClick={step === 9 ? createAccount : next}
            disabled={(step === 9 && !accountOk) || (step === 9 && authBusy)}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-[0.98]",
              step === 9 && !accountOk && "opacity-40",
              step === 9 && authBusy && "opacity-60",
            )}
          >
            {step === 0
              ? "Get started"
              : step === 8
                ? "Save my program"
                : step === 9
                  ? authBusy
                    ? "Creating…"
                    : "Create my account"
                  : "Continue"}
            <ArrowRight className="h-5 w-5" />
          </button>
          )}
          {step === 9 && authError && (
            <p className="mt-2 text-center text-sm font-semibold text-destructive">{authError}</p>
          )}
          {step === 0 && !loginMode && (
            <button
              type="button"
              onClick={() => setLoginMode(true)}
              className="mt-3 w-full text-center text-sm font-medium text-muted-foreground"
            >
              I already have an account
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function NotificationsStep({ onEnter, name }: { onEnter: () => void; name: string }) {
  const { permission, enable } = useSmartNotifications()
  const [busy, setBusy] = useState(false)
  const granted = permission === "granted"

  return (
    <div className="flex flex-1 flex-col animate-slide-up">
      <div className="mx-auto mt-4 flex h-28 w-28 items-center justify-center rounded-[2rem] bg-accent text-6xl">
        {granted ? "🔔" : "🔕"}
      </div>
      <h1 className="mt-6 text-3xl font-extrabold tracking-tight">
        {granted ? "Reminders on!" : "Stay on track, " + (name.trim().split(/\s+/)[0] || "champ")}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {granted
          ? "Sahtek will nudge you if your streak is at risk, if you're under your goal, or if you haven't logged in a while."
          : "Allow notifications so Sahtek can remind you to log meals, protect your streak and reach your goal — never spam."}
      </p>
      {!granted && (
        <button
          type="button"
          onClick={async () => {
            setBusy(true)
            await enable()
            setBusy(false)
          }}
          disabled={busy}
          className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-bold text-primary-foreground shadow-lg shadow-primary/30 active:scale-[0.98]"
        >
          {busy ? "Asking…" : "🔔 Allow notifications"}
        </button>
      )}
      <button
        type="button"
        onClick={onEnter}
        className="mt-3 w-full py-3 text-center text-sm font-bold text-muted-foreground"
      >
        {granted || permission === "denied" ? "Enter my dashboard →" : "Maybe later — enter dashboard →"}
      </button>
    </div>
  )
}

function WelcomeStep() {
  return (
    <div className="flex flex-1 flex-col animate-slide-up">
      <div className="relative mx-auto mt-2 aspect-square w-full max-w-[300px] overflow-hidden rounded-[2rem] bg-accent">
        <Image
          src="/images/onboarding-hero.png"
          alt="A person enjoying fresh healthy food"
          fill
          className="object-cover"
          priority
        />
      </div>
      <div className="mt-8 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Leaf className="h-4 w-4" />
        </span>
        <span className="text-lg font-extrabold tracking-tight">Sahtek</span>
      </div>
      <h1 className="mt-4 text-balance text-4xl font-extrabold leading-[1.1] tracking-tight">
        Your health journey starts here
      </h1>
      <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
        Answer a few questions, get a personalized program, then create your account. Everything is saved on this device.
      </p>
    </div>
  )
}

function GoalStep({ goal, setGoal }: { goal: Goal; setGoal: (g: Goal) => void }) {
  return (
    <div className="flex flex-1 flex-col animate-slide-up">
      <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight">What&apos;s your goal?</h2>
      <p className="mt-2 text-muted-foreground">We&apos;ll personalize everything around it.</p>
      <div className="mt-8 flex flex-col gap-4">
        {goals.map((g) => {
          const Icon = g.icon
          const active = goal === g.key
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => setGoal(g.key)}
              className={cn(
                "flex items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all",
                active ? "border-primary bg-accent" : "border-border bg-card",
              )}
            >
              <span
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-xl",
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                )}
              >
                <Icon className="h-6 w-6" />
              </span>
              <span className="flex-1">
                <span className="block text-base font-bold">{g.label}</span>
                <span className="block text-sm text-muted-foreground">{g.desc}</span>
              </span>
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full border-2",
                  active ? "border-primary bg-primary text-primary-foreground" : "border-border",
                )}
              >
                {active && <Check className="h-4 w-4" strokeWidth={3} />}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StatsStep(props: {
  gender: Gender
  setGender: (g: Gender) => void
  age: number
  setAge: (n: number) => void
  height: number
  setHeight: (n: number) => void
  weight: number
  setWeight: (n: number) => void
}) {
  const { gender, setGender, age, setAge, height, setHeight, weight, setWeight } = props
  return (
    <div className="flex flex-1 flex-col animate-slide-up">
      <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight">A bit about you</h2>
      <p className="mt-2 text-muted-foreground">This helps us calculate your ideal targets.</p>

      <div className="mt-6 space-y-5">
        <div>
          <label className="mb-2 block text-sm font-semibold">Gender</label>
          <div className="grid grid-cols-2 gap-3">
            {(["female", "male"] as Gender[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(g)}
                className={cn(
                  "rounded-xl border-2 py-3 text-sm font-bold capitalize transition-all",
                  gender === g ? "border-primary bg-accent text-foreground" : "border-border bg-card text-muted-foreground",
                )}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <Stepper label="Age" value={age} unit="years" min={14} max={90} step={1} onChange={setAge} />
        <Stepper label="Height" value={height} unit="cm" min={130} max={220} step={1} onChange={setHeight} />
        <Stepper label="Current weight" value={weight} unit="kg" min={35} max={200} step={1} onChange={setWeight} />
      </div>
    </div>
  )
}

function TargetWeightStep({
  goal,
  weight,
  targetWeight,
  setTargetWeight,
}: {
  goal: Goal
  weight: number
  targetWeight: number
  setTargetWeight: (n: number) => void
}) {
  const delta = Math.round((targetWeight - weight) * 10) / 10
  return (
    <div className="flex flex-1 flex-col animate-slide-up">
      <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight">Your target weight</h2>
      <p className="mt-2 text-muted-foreground">
        {goal === "maintain"
          ? "We'll keep your current weight as the reference."
          : "Where do you want to be? We'll pace the plan for you."}
      </p>

      {goal !== "maintain" && (
        <div className="mt-8">
          <Stepper label="Target weight" value={targetWeight} unit="kg" min={35} max={200} step={0.5} onChange={setTargetWeight} />
          <div
            className={cn(
              "mt-4 rounded-2xl border p-4 text-sm",
              delta === 0
                ? "border-border bg-card text-muted-foreground"
                : delta < 0
                  ? "border-primary/40 bg-accent text-foreground"
                  : "border-carbs/40 bg-card text-foreground",
            )}
          >
            {delta === 0 ? (
              "Same as your current weight — maintenance it is."
            ) : (
              <>
                <span className="font-extrabold">
                  {delta < 0 ? `${Math.abs(delta)} kg to lose` : `${delta} kg to gain`}
                </span>
                <span className="mt-1 block text-muted-foreground">
                  A healthy pace is about 0.5 kg per week. We&apos;ll adjust your calories to match.
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ActivityStep({ activity, setActivity }: { activity: number; setActivity: (n: number) => void }) {
  return (
    <div className="flex flex-1 flex-col animate-slide-up">
      <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight">How active are you?</h2>
      <p className="mt-2 text-muted-foreground">Be honest — it shapes your daily calories.</p>
      <div className="mt-8 space-y-2">
        {activityLevels.map((a) => (
          <button
            key={a.value}
            type="button"
            onClick={() => setActivity(a.value)}
            className={cn(
              "flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition-all",
              activity === a.value ? "border-primary bg-accent" : "border-border bg-card",
            )}
          >
            <span>
              <span className="block text-sm font-bold">{a.label}</span>
              <span className="block text-xs text-muted-foreground">{a.desc}</span>
            </span>
            {activity === a.value && <Check className="h-5 w-5 text-primary" strokeWidth={3} />}
          </button>
        ))}
      </div>
    </div>
  )
}

function DietStep({ diet, setDiet }: { diet: Diet; setDiet: (d: Diet) => void }) {
  return (
    <div className="flex flex-1 flex-col animate-slide-up">
      <span className="mt-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-primary">
        <Salad className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight">Any diet?</h2>
      <p className="mt-2 text-muted-foreground">We&apos;ll adapt suggestions and scan results.</p>
      <div className="mt-8 space-y-2">
        {diets.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => setDiet(d.key)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all",
              diet === d.key ? "border-primary bg-accent" : "border-border bg-card",
            )}
          >
            <span className="text-xl">{d.emoji}</span>
            <span className="flex-1">
              <span className="block text-sm font-bold">{d.label}</span>
              <span className="block text-xs text-muted-foreground">{d.desc}</span>
            </span>
            {diet === d.key && <Check className="h-5 w-5 text-primary" strokeWidth={3} />}
          </button>
        ))}
      </div>
    </div>
  )
}

function AllergiesStep({
  selected,
  toggle,
}: {
  selected: string[]
  toggle: (key: string) => void
}) {
  return (
    <div className="flex flex-1 flex-col animate-slide-up">
      <span className="mt-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-fat-soft text-fat">
        <ShieldAlert className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight">Allergies?</h2>
      <p className="mt-2 text-muted-foreground">Select everything that applies. Skip if none.</p>
      <div className="mt-8 grid grid-cols-2 gap-3">
        {allergies.map((a) => {
          const active = selected.includes(a.key)
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
      <p className="mt-4 rounded-xl bg-card p-3 text-xs text-muted-foreground">
        We&apos;ll flag scanned foods containing these allergens.
      </p>
    </div>
  )
}

function HabitsStep(props: {
  mealsPerDay: number
  setMealsPerDay: (n: number) => void
  waterGoal: number
  setWaterGoal: (n: number) => void
  stepGoal: number
  setStepGoal: (n: number) => void
}) {
  const { mealsPerDay, setMealsPerDay, waterGoal, setWaterGoal, stepGoal, setStepGoal } = props
  return (
    <div className="flex flex-1 flex-col animate-slide-up">
      <span className="mt-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-steps-soft text-steps">
        <Utensils className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight">Your daily habits</h2>
      <p className="mt-2 text-muted-foreground">We&apos;ll structure your journal around them.</p>

      <div className="mt-8 space-y-6">
        <div>
          <label className="mb-2 block text-sm font-semibold">Meals per day</label>
          <div className="grid grid-cols-3 gap-3">
            {mealsPerDayOptions.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setMealsPerDay(n)}
                className={cn(
                  "rounded-xl border-2 py-3 text-sm font-extrabold transition-all",
                  mealsPerDay === n ? "border-primary bg-accent text-foreground" : "border-border bg-card text-muted-foreground",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <Stepper label="Water goal" value={waterGoal} unit="glasses" min={2} max={20} step={1} onChange={setWaterGoal} />
        <Stepper label="Steps goal" value={stepGoal} unit="steps" min={2000} max={30000} step={1000} onChange={setStepGoal} />
      </div>
    </div>
  )
}

/** Preview of the personalized program, shown right before account creation. */
function ProgramStep({
  result,
  goal,
  mealsPerDay,
  name,
}: {
  result: ReturnType<typeof calcNutrition>
  goal: Goal
  mealsPerDay: number
  name: string
}) {
  const perMeal = Math.round(result.calories / mealsPerDay)
  const firstName = name.trim().split(/\s+/)[0]
  return (
    <div className="flex flex-1 flex-col animate-slide-up">
      <div className="mt-2 flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-primary">
          <Sparkles className="h-6 w-6" />
        </span>
        <div>
          <h2 className="text-2xl font-extrabold leading-tight tracking-tight">Your program is ready</h2>
          {firstName && <p className="text-sm text-muted-foreground">Built for you, {firstName}</p>}
        </div>
      </div>

      <div className="mt-6 rounded-3xl bg-gradient-to-br from-primary/25 to-primary/5 p-6 text-center">
        <p className="text-sm font-semibold text-muted-foreground">Daily calorie target</p>
        <div className="mt-1 flex items-end justify-center gap-2">
          <span className="text-5xl font-extrabold tabular-nums text-primary">
            <AnimatedCounter value={result.calories} />
          </span>
          <span className="pb-2 text-xl font-bold text-muted-foreground">kcal</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {goal === "lose" ? "Deficit" : goal === "gain" ? "Surplus" : "Maintenance"} · based on your BMR {result.bmr} kcal
        </p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {[
          { label: "Protein", value: result.protein, className: "text-protein" },
          { label: "Carbs", value: result.carbs, className: "text-carbs" },
          { label: "Fat", value: result.fat, className: "text-fat" },
        ].map((m) => (
          <div key={m.label} className="rounded-2xl border border-border bg-card p-3 text-center">
            <p className="text-xs text-muted-foreground">{m.label}</p>
            <p className={cn("mt-1 text-lg font-extrabold tabular-nums", m.className)}>{m.value} g</p>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {[
          { icon: <Utensils className="h-4 w-4" />, label: `${mealsPerDay} meals a day`, desc: `≈ ${perMeal} kcal per meal` },
          { icon: <Droplets className="h-4 w-4" />, label: "Hydration", desc: "follows your water goal" },
          { icon: <Footprints className="h-4 w-4" />, label: "Activity", desc: "follows your steps goal" },
        ].map((row, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-primary">{row.icon}</span>
            <span className="flex-1">
              <span className="block text-sm font-bold">{row.label}</span>
              <span className="block text-xs text-muted-foreground">{row.desc}</span>
            </span>
          </div>
        ))}
      </div>

      <p className="mt-4 rounded-xl bg-card p-3 text-xs text-muted-foreground">
        Create your account on the next step to save this program.
      </p>
    </div>
  )
}

function AccountStep(props: {
  name: string
  setName: (s: string) => void
  email: string
  setEmail: (s: string) => void
  password: string
  setPassword: (s: string) => void
  showPassword: boolean
  setShowPassword: (b: boolean) => void
  nameOk: boolean
  emailOk: boolean
  passOk: boolean
}) {
  const { name, setName, email, setEmail, password, setPassword, showPassword, setShowPassword, nameOk, emailOk, passOk } = props
  return (
    <div className="flex flex-1 flex-col animate-slide-up">
      <span className="mt-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-primary">
        <User className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight">Create your account</h2>
      <p className="mt-2 text-muted-foreground">Your program and progress are saved on this device.</p>

      <div className="mt-8 space-y-5">
        <Field label="Full name" ok={nameOk} icon={User}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex Morgan"
            autoComplete="name"
            className="w-full bg-transparent text-base font-semibold outline-none placeholder:text-muted-foreground/50"
          />
        </Field>

        <Field label="Email" ok={emailOk} icon={Mail}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            type="email"
            inputMode="email"
            autoComplete="email"
            className="w-full bg-transparent text-base font-semibold outline-none placeholder:text-muted-foreground/50"
          />
        </Field>

        <Field label="Password" ok={passOk} icon={Lock} hint="At least 6 characters">
          <div className="flex items-center gap-2">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              className="w-full bg-transparent text-base font-semibold outline-none placeholder:text-muted-foreground/50"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="text-muted-foreground"
            >
              {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
            </button>
          </div>
        </Field>
      </div>
    </div>
  )
}

function Field({
  label,
  icon: Icon,
  ok,
  hint,
  children,
}: {
  label: string
  icon: typeof User
  ok: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold">{label}</label>
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border-2 bg-card px-4 py-3.5 transition-colors",
          ok ? "border-primary/60" : "border-border",
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-foreground" />
        </span>
        <div className="min-w-0 flex-1">{children}</div>
        {ok && <Check className="h-4.5 w-4.5 shrink-0 text-primary" strokeWidth={3} />}
      </div>
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Celebration: account created, personalized program revealed with animation. */
function CreatedStep({
  name,
  result,
  mealsPerDay,
  waterGoal,
  stepGoal,
  onEnter,
}: {
  name: string
  result: ReturnType<typeof calcNutrition>
  mealsPerDay: number
  waterGoal: number
  stepGoal: number
  onEnter: () => void
}) {
  const [phase, setPhase] = useState<0 | 1>(0)
  const firstName = name.trim().split(/\s+/)[0]
  const perMeal = Math.round(result.calories / mealsPerDay)

  useEffect(() => {
    const t = window.setTimeout(() => setPhase(1), 1400)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <div className="flex flex-1 flex-col items-center justify-center pb-4 text-center">
      {/* Phase 0 — account created burst */}
      <div className={cn("flex flex-col items-center transition-all duration-500", phase === 1 && "scale-75 opacity-0")}>
        <span className="flex h-20 w-20 animate-pop-in items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/40">
          <Check className="h-10 w-10" strokeWidth={3} />
        </span>
        <h2 className="mt-6 flex items-center gap-2 text-3xl font-extrabold tracking-tight animate-pop-in [animation-delay:120ms]">
          <PartyPopper className="h-7 w-7 text-carbs" />
          Account created!
        </h2>
        <p className="mt-2 text-sm text-muted-foreground animate-pop-in [animation-delay:220ms]">
          Everything you told us has been saved.
        </p>
      </div>

      {/* Phase 1 — personalized program reveal */}
      {phase === 1 && (
        <div className="flex w-full flex-col items-center">
          <span className="flex h-14 w-14 animate-pop-in items-center justify-center rounded-2xl bg-accent text-primary">
            <Sparkles className="h-7 w-7" />
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight animate-slide-up">
            {firstName ? `Welcome, ${firstName}` : "Welcome"} 👋
          </h2>
          <p className="mt-2 text-sm text-muted-foreground animate-slide-up [animation-delay:80ms]">
            Here&apos;s your personalized program.
          </p>

          <div className="mt-6 w-full rounded-3xl bg-gradient-to-br from-primary/25 to-primary/5 p-6 animate-slide-up [animation-delay:160ms]">
            <p className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
              <Flame className="h-4 w-4 text-primary" />
              Your daily target
            </p>
            <div className="mt-1 flex items-end justify-center gap-2">
              <span className="text-5xl font-extrabold tabular-nums text-primary">
                <AnimatedCounter value={result.calories} />
              </span>
              <span className="pb-2 text-xl font-bold text-muted-foreground">kcal</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Day one starts at 0 — log your first meal!</p>
          </div>

          <div className="mt-4 grid w-full grid-cols-3 gap-3 animate-slide-up [animation-delay:240ms]">
            {[
              { label: "Protein", value: `${result.protein}g`, className: "text-protein" },
              { label: "Carbs", value: `${result.carbs}g`, className: "text-carbs" },
              { label: "Fat", value: `${result.fat}g`, className: "text-fat" },
            ].map((m) => (
              <div key={m.label} className="rounded-2xl border border-border bg-card p-3 text-center">
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className={cn("mt-1 text-base font-extrabold tabular-nums", m.className)}>{m.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 flex w-full items-center justify-center gap-2 text-xs text-muted-foreground animate-slide-up [animation-delay:320ms]">
            <span className="rounded-full bg-card px-3 py-1.5">{mealsPerDay} meals · ≈{perMeal} kcal each</span>
            <span className="rounded-full bg-card px-3 py-1.5">💧 {waterGoal} glasses</span>
            <span className="rounded-full bg-card px-3 py-1.5">👟 {stepGoal.toLocaleString()}</span>
          </div>

          <button
            type="button"
            onClick={onEnter}
            className="mt-7 flex w-full animate-slide-up items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-[0.98] [animation-delay:420ms]"
          >
            Enter your dashboard
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      )}
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

function LoginStep({
  email,
  setEmail,
  password,
  setPassword,
  onBack,
  onSubmit,
  busy,
  error,
}: {
  email: string
  setEmail: (v: string) => void
  password: string
  setPassword: (v: string) => void
  onBack: () => void
  onSubmit: () => void
  busy: boolean
  error: string | null
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex flex-1 flex-col animate-slide-up">
      <button
        type="button"
        onClick={onBack}
        className="mb-2 flex w-fit items-center gap-1 text-sm font-semibold text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <h1 className="text-3xl font-extrabold tracking-tight">Welcome back 👋</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Log in to find your program, your journal and your streak — right where you left them.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <label className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3.5 shadow-sm">
          <Mail className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
          />
        </label>
        <label className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3.5 shadow-sm">
          <Lock className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSubmit()
            }}
            placeholder="Password"
            autoComplete="current-password"
            className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
          />
          <button type="button" onClick={() => setShow(!show)} aria-label="Toggle password visibility">
            {show ? <EyeOff className="h-5 w-5 text-muted-foreground" /> : <Eye className="h-5 w-5 text-muted-foreground" />}
          </button>
        </label>
        {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
      </div>
      {busy && <p className="mt-4 animate-pulse text-sm text-muted-foreground">Checking your account…</p>}
    </div>
  )
}
