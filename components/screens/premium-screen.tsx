"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import {
  X,
  Check,
  Sparkles,
  Brain,
  ChartLine,
  Utensils,
  Crown,
  CreditCard,
  Lock,
  Loader2,
  ShieldCheck,
  ScanLine,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { usePremium, type PremiumPlan } from "@/lib/premium"

type Step = "plans" | "checkout" | "processing" | "success" | "manage"

const features = [
  { icon: ScanLine, title: "Unlimited meal scans", desc: "Snap every plate, no daily limit" },
  { icon: Brain, title: "AI Nutrition Coach", desc: "Personalized guidance every day" },
  { icon: ChartLine, title: "Advanced Insights", desc: "Deep trends & macro breakdowns" },
  { icon: Utensils, title: "Custom Meal Plans", desc: "Recipes tailored to your goals" },
  { icon: Sparkles, title: "No Ads, Ever", desc: "A clean, focused experience" },
]

const plans: { id: PremiumPlan; label: string; price: string; per: string; note: string }[] = [
  { id: "yearly", label: "Yearly", price: "$59.99", per: "/year", note: "Save 50%" },
  { id: "monthly", label: "Monthly", price: "$9.99", per: "/month", note: "" },
]

export function PremiumScreen({ onClose }: { onClose: () => void }) {
  const { premium, isPremium, subscribe, cancel, resume } = usePremium()
  const [step, setStep] = useState<Step>(premium.plan ? "manage" : "plans")
  const [plan, setPlan] = useState<PremiumPlan>("yearly")
  const [card, setCard] = useState({ number: "", name: "", expiry: "", cvc: "" })
  const [error, setError] = useState<string | null>(null)

  const renewalDate = useMemo(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + (plan === "yearly" ? 12 : 1))
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }, [plan])

  const validCard =
    card.number.replace(/\s/g, "").length >= 15 &&
    card.name.trim().length >= 2 &&
    /^\d{2}\s?\/\s?\d{2}$/.test(card.expiry) &&
    /^\d{3,4}$/.test(card.cvc)

  const last4 = card.number.replace(/\D/g, "").slice(-4) || "4242"

  const pay = () => {
    if (!validCard) {
      setError("Please complete all card fields.")
      return
    }
    setError(null)
    setStep("processing")
    window.setTimeout(() => {
      subscribe(plan, last4)
      setStep("success")
    }, 1800)
  }

  const formatDate = (iso: string | null) =>
    iso
      ? new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—"

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-secondary text-[#e6fff1] animate-slide-up">
      <div className="flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-2">
          {step === "checkout" && (
            <button
              type="button"
              onClick={() => setStep("plans")}
              aria-label="Back to plans"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#a7f3d0]/10"
            >
              <X className="h-5 w-5 rotate-45" />
            </button>
          )}
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/20 text-primary">
            <Crown className="h-5 w-5" />
          </span>
          <h1 className="text-lg font-extrabold tracking-tight">
            {step === "manage" ? "Manage subscription" : step === "checkout" ? "Payment" : "Nourish Premium"}
          </h1>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close premium"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#a7f3d0]/10"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* ---------- PLANS ---------- */}
      {step === "plans" && (
        <>
          <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-6">
            <div className="relative mx-auto h-40 w-40">
              <Image
                src="/images/premium-hero.png"
                alt="Premium nutrition coaching illustration"
                fill
                className="object-contain"
              />
            </div>
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1 text-xs font-bold text-primary">
                <Crown className="h-3.5 w-3.5" />
                NOURISH PREMIUM
              </span>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-balance">
                Reach your goals faster
              </h2>
              <p className="mt-2 text-sm text-[#e6fff1]/60 text-pretty">
                Join 500,000+ members getting stronger with premium tools.
              </p>
            </div>

            <div className="mt-7 space-y-3">
              {features.map((f) => (
                <div key={f.title} className="flex items-center gap-3 rounded-2xl bg-[#a7f3d0]/5 p-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <div className="flex-1">
                    <p className="font-bold">{f.title}</p>
                    <p className="text-xs text-[#e6fff1]/50">{f.desc}</p>
                  </div>
                  <Check className="h-5 w-5 text-primary" strokeWidth={2.5} />
                </div>
              ))}
            </div>

            <div className="mt-7 grid grid-cols-2 gap-3">
              {plans.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlan(p.id)}
                  className={cn(
                    "relative rounded-2xl border-2 p-4 text-left transition-all",
                    plan === p.id ? "border-primary bg-primary/10" : "border-[#a7f3d0]/10 bg-[#a7f3d0]/5",
                  )}
                >
                  {p.note && (
                    <span className="absolute -top-2.5 right-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-extrabold text-primary-foreground">
                      {p.note}
                    </span>
                  )}
                  <p className="text-sm font-bold text-[#e6fff1]/70">{p.label}</p>
                  <p className="mt-1 text-2xl font-extrabold">{p.price}</p>
                  <p className="text-xs text-[#e6fff1]/50">{p.per}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-[#a7f3d0]/10 bg-secondary px-6 pb-8 pt-4">
            <button
              type="button"
              onClick={() => setStep("checkout")}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-extrabold text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-[0.98]"
            >
              <Crown className="h-5 w-5" />
              Start 7-day free trial
            </button>
            <p className="mt-3 text-center text-xs text-[#e6fff1]/40">
              Cancel anytime · Billed {plan === "yearly" ? "annually" : "monthly"} after trial
            </p>
          </div>
        </>
      )}

      {/* ---------- CHECKOUT ---------- */}
      {step === "checkout" && (
        <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-6">
          <div className="rounded-2xl bg-[#a7f3d0]/5 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">{plan === "yearly" ? "Yearly plan" : "Monthly plan"}</p>
              <p className="text-sm font-extrabold text-primary">
                {plan === "yearly" ? "$59.99/yr" : "$9.99/mo"}
              </p>
            </div>
            <p className="mt-1 text-xs text-[#e6fff1]/50">
              7 days free, then {plan === "yearly" ? "$59.99 on {date}" : "$9.99 monthly"} · first charge{" "}
              {renewalDate}
            </p>
          </div>

          <div className="mt-5 space-y-4">
            <Field label="Card number" icon={<CreditCard className="h-4 w-4" />}>
              <input
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="4242 4242 4242 4242"
                value={card.number}
                onChange={(e) =>
                  setCard((c) => ({
                    ...c,
                    number: e.target.value
                      .replace(/\D/g, "")
                      .slice(0, 16)
                      .replace(/(.{4})/g, "$1 ")
                      .trim(),
                  }))
                }
                className="w-full bg-transparent text-sm font-semibold tracking-wide outline-none placeholder:text-[#e6fff1]/30"
              />
            </Field>
            <Field label="Name on card">
              <input
                autoComplete="cc-name"
                placeholder="ALEX MORGAN"
                value={card.name}
                onChange={(e) => setCard((c) => ({ ...c, name: e.target.value }))}
                className="w-full bg-transparent text-sm font-semibold uppercase outline-none placeholder:text-[#e6fff1]/30"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Expiry">
                <input
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  placeholder="MM/YY"
                  value={card.expiry}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 4)
                    const formatted =
                      digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
                    setCard((c) => ({ ...c, expiry: formatted }))
                  }}
                  className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-[#e6fff1]/30"
                />
              </Field>
              <Field label="CVC">
                <input
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  placeholder="123"
                  value={card.cvc}
                  onChange={(e) =>
                    setCard((c) => ({ ...c, cvc: e.target.value.replace(/\D/g, "").slice(0, 4) }))
                  }
                  className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-[#e6fff1]/30"
                />
              </Field>
            </div>
          </div>

          {error && <p className="mt-4 text-center text-sm font-semibold text-red-400">{error}</p>}

          <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-[#e6fff1]/40">
            <Lock className="h-3.5 w-3.5" />
            Demo checkout — no real payment is processed
          </div>
        </div>
      )}

      {/* ---------- PROCESSING ---------- */}
      {step === "processing" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-10 text-center">
          <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary/15">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </span>
          <div>
            <p className="text-lg font-extrabold">Processing payment…</p>
            <p className="mt-1 text-sm text-[#e6fff1]/50">Securing your subscription</p>
          </div>
        </div>
      )}

      {/* ---------- SUCCESS ---------- */}
      {step === "success" && (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center animate-pop-in">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-10 w-10" strokeWidth={3} />
          </span>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight">You&apos;re Premium! 👑</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#e6fff1]/60">
            Unlimited meal scans, AI coaching and advanced insights are now unlocked.
          </p>
          <div className="mt-6 w-full rounded-2xl bg-[#a7f3d0]/5 p-4 text-left text-sm">
            <div className="flex justify-between py-1">
              <span className="text-[#e6fff1]/50">Plan</span>
              <span className="font-bold capitalize">{plan}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[#e6fff1]/50">First charge</span>
              <span className="font-bold">{renewalDate}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[#e6fff1]/50">Card</span>
              <span className="font-bold">•••• {last4}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-8 w-full rounded-2xl bg-primary py-4 text-base font-extrabold text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-[0.98]"
          >
            Start exploring
          </button>
        </div>
      )}

      {/* ---------- MANAGE ---------- */}
      {step === "manage" && (
        <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-8">
          <div className="rounded-3xl bg-gradient-to-br from-primary/25 to-primary/5 p-6 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Crown className="h-7 w-7" />
            </span>
            <h2 className="mt-4 text-2xl font-extrabold tracking-tight">
              {isPremium ? "Premium active" : "Subscription ending"}
            </h2>
            <p className="mt-1 text-sm text-[#e6fff1]/60">
              {isPremium
                ? `Renews on ${formatDate(premium.renews)}`
                : `Access ends on ${formatDate(premium.cancelAt)}`}
            </p>
          </div>

          <div className="mt-5 rounded-2xl bg-[#a7f3d0]/5 p-4">
            <Row label="Plan" value={premium.plan ? premium.plan[0].toUpperCase() + premium.plan.slice(1) : "—"} />
            <Row label="Price" value={premium.plan === "yearly" ? "$59.99 / year" : "$9.99 / month"} />
            <Row label="Member since" value={formatDate(premium.since)} />
            <Row label="Payment method" value={premium.cardLast4 ? `•••• ${premium.cardLast4}` : "—"} last />
          </div>

          <div className="mt-5 flex items-start gap-2 rounded-2xl bg-[#a7f3d0]/5 p-4 text-xs text-[#e6fff1]/50">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            Cancel anytime — you keep Premium until the end of the paid period. No hidden fees.
          </div>

          {isPremium ? (
            <button
              type="button"
              onClick={() => {
                cancel()
              }}
              className="mt-6 w-full rounded-2xl border border-[#a7f3d0]/15 py-3.5 text-sm font-bold text-[#e6fff1]/70 active:scale-[0.99]"
            >
              Cancel subscription
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                resume()
              }}
              className="mt-6 w-full rounded-2xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground active:scale-[0.99]"
            >
              Resume subscription
            </button>
          )}
        </div>
      )}

      {/* Checkout CTA */}
      {step === "checkout" && (
        <div className="border-t border-[#a7f3d0]/10 bg-secondary px-6 pb-8 pt-4">
          <button
            type="button"
            onClick={pay}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-extrabold text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-[0.98]"
          >
            <Lock className="h-4 w-4" />
            Pay {plan === "yearly" ? "$59.99" : "$9.99"} · start free trial
          </button>
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  icon,
  children,
}: {
  label: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#e6fff1]/50">
        {icon}
        {label}
      </span>
      <span className="flex items-center rounded-xl border border-[#a7f3d0]/10 bg-[#a7f3d0]/5 px-4 py-3 focus-within:border-primary/60">
        {children}
      </span>
    </label>
  )
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between py-2", !last && "border-b border-[#a7f3d0]/20/5")}>
      <span className="text-sm text-[#e6fff1]/50">{label}</span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  )
}
