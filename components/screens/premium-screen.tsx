"use client"

import { useMemo, useState } from "react"
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
  Ticket,
  Smartphone,
  Wallet,
  Landmark,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { usePremium, type PremiumPlan } from "@/lib/premium"

type Step = "plans" | "checkout" | "processing" | "success" | "manage" | "redeem"
type PayMethod = "flouci" | "d17" | "edinar" | "card"

const features = [
  { icon: ScanLine, title: "Scans de repas illimités", desc: "Photographie chaque plat, sans limite" },
  { icon: Brain, title: "Coach nutrition IA", desc: "Conseils personnalisés chaque jour" },
  { icon: ChartLine, title: "Analyses avancées", desc: "Tendances et macros en profondeur" },
  { icon: Utensils, title: "Programmes sur mesure", desc: "Recettes adaptées à tes objectifs" },
  { icon: Sparkles, title: "Zéro pub, pour toujours", desc: "Une expérience nette et concentrée" },
]

const PLANS: Record<PremiumPlan, { label: string; priceTND: string; per: string; note: string }> = {
  yearly: { label: "Annuel", priceTND: "199 DT", per: "/an", note: "-43%" },
  monthly: { label: "Mensuel", priceTND: "29 DT", per: "/mois", note: "" },
}

const METHODS: { id: PayMethod; label: string; desc: string; icon: typeof Smartphone }[] = [
  { id: "flouci", label: "Flouci", desc: "Paiement mobile — le plus rapide", icon: Smartphone },
  { id: "d17", label: "D17 / La Poste", desc: "Carte prepaid D17", icon: Wallet },
  { id: "edinar", label: "e-Dinar", desc: "Carte e-Dinar Smart", icon: Landmark },
  { id: "card", label: "Carte bancaire", desc: "Visa / Mastercard internationales", icon: CreditCard },
]

export function PremiumScreen({ onClose }: { onClose: () => void }) {
  const { premium, isPremium, subscribe, cancel, resume } = usePremium()
  const [step, setStep] = useState<Step>(premium.plan ? "manage" : "plans")
  const [plan, setPlan] = useState<PremiumPlan>("yearly")
  const [method, setMethod] = useState<PayMethod>("flouci")
  const [card, setCard] = useState({ number: "", name: "", expiry: "", cvc: "" })
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [codeMsg, setCodeMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const validCard =
    card.number.replace(/\s/g, "").length >= 15 &&
    card.name.trim().length >= 2 &&
    /^\d{2}\s?\/\s?\d{2}$/.test(card.expiry) &&
    /^\d{3,4}$/.test(card.cvc)

  const validPhone = /^(\+216)?[2-9]\d{7}$/.test(phone.replace(/\s/g, ""))

  const last4 = card.number.replace(/\D/g, "").slice(-4) || "0000"

  const price = PLANS[plan]

  const pay = () => {
    if (method === "card" && !validCard) {
      setError("Complète toutes les infos de la carte.")
      return
    }
    if (method !== "card" && !validPhone) {
      setError("Entre un numéro tunisien valide (8 chiffres).")
      return
    }
    setError(null)
    setStep("processing")
    window.setTimeout(() => {
      subscribe(plan, method === "card" ? last4 : phone.replace(/\D/g, "").slice(-4))
      setStep("success")
    }, 1600)
  }

  const redeem = async () => {
    setBusy(true)
    setCodeMsg(null)
    try {
      const res = await fetch("/api/premium/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string; months?: number; premiumUntil?: string } | null
      if (!res.ok) {
        setCodeMsg(data?.error ?? "Code invalide")
        return
      }
      // Server has credited months — mirror locally so the UI unlocks immediately.
      subscribe(premium.plan ?? "monthly", `CODE ${code.slice(0, 4)}…`)
      setCodeMsg(null)
      setCode("")
      setStep("success")
    } catch {
      setCodeMsg("Connexion impossible — réessaie.")
    } finally {
      setBusy(false)
    }
  }

  const formatDate = (iso: string | null) =>
    iso
      ? new Date(iso + "T00:00:00").toLocaleDateString("fr-TN", { day: "numeric", month: "long", year: "numeric" })
      : "—"

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-secondary text-[#e6fff1] animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-2">
          {step === "checkout" && (
            <button
              type="button"
              onClick={() => setStep("plans")}
              aria-label="Retour aux formules"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#a7f3d0]/10"
            >
              <X className="h-5 w-5 rotate-45" />
            </button>
          )}
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/20 text-primary">
            <Crown className="h-5 w-5" />
          </span>
          <h1 className="text-lg font-extrabold tracking-tight">
            {step === "manage" ? "Mon abonnement" : step === "checkout" ? "Paiement" : step === "redeem" ? "Code d'activation" : "Sahtek Premium"}
          </h1>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#a7f3d0]/10"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* ---------- PLANS ---------- */}
      {step === "plans" && (
        <>
          <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-6">
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1 text-xs font-bold text-primary">
                <Crown className="h-3.5 w-3.5" />
                SAHTEK PREMIUM
              </span>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-balance">Atteins tes objectifs plus vite</h2>
              <p className="mt-2 text-pretty text-sm text-[#e6fff1]/60">Paiement en dinar tunisien 🇹🇳 — annulable à tout moment.</p>
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
              {(Object.keys(PLANS) as PremiumPlan[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlan(p)}
                  className={cn(
                    "relative rounded-2xl border-2 p-4 text-left transition-all",
                    plan === p ? "border-primary bg-primary/10" : "border-[#a7f3d0]/10 bg-[#a7f3d0]/5",
                  )}
                >
                  {PLANS[p].note && (
                    <span className="absolute -top-2.5 right-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-extrabold text-primary-foreground">
                      {PLANS[p].note}
                    </span>
                  )}
                  <p className="text-sm font-bold text-[#e6fff1]/70">{PLANS[p].label}</p>
                  <p className="mt-1 text-2xl font-extrabold">{PLANS[p].priceTND}</p>
                  <p className="text-xs text-[#e6fff1]/50">{PLANS[p].per}</p>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setStep("redeem")
                setCodeMsg(null)
              }}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[#a7f3d0]/25 py-3.5 text-sm font-bold text-[#e6fff1]/80 active:scale-[0.99]"
            >
              <Ticket className="h-4 w-4 text-primary" />
              J&apos;ai un code d&apos;activation
            </button>
          </div>

          <div className="border-t border-[#a7f3d0]/10 bg-secondary px-6 pb-8 pt-4">
            <button
              type="button"
              onClick={() => setStep("checkout")}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-extrabold text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-[0.98]"
            >
              <Crown className="h-5 w-5" />
              Passer Premium — {price.priceTND}{price.per}
            </button>
            <p className="mt-3 text-center text-xs text-[#e6fff1]/40">Sans engagement · Annule quand tu veux</p>
          </div>
        </>
      )}

      {/* ---------- CHECKOUT ---------- */}
      {step === "checkout" && (
        <>
          <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-6">
            <div className="rounded-2xl bg-[#a7f3d0]/5 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">Formule {price.label.toLowerCase()}</p>
                <p className="text-sm font-extrabold text-primary">
                  {price.priceTND}{price.per}
                </p>
              </div>
              <p className="mt-1 text-xs text-[#e6fff1]/50">Montant en dinar tunisien (TND) — facture par SMS/email.</p>
            </div>

            <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-[#e6fff1]/50">Mode de paiement</p>
            <div className="space-y-2">
              {METHODS.map((m) => {
                const Icon = m.icon
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border-2 p-3.5 text-left transition-all",
                      method === m.id ? "border-primary bg-primary/10" : "border-[#a7f3d0]/10 bg-[#a7f3d0]/5",
                    )}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">{m.label}</span>
                      <span className="block text-xs text-[#e6fff1]/50">{m.desc}</span>
                    </span>
                    {method === m.id && <Check className="h-5 w-5 text-primary" strokeWidth={2.5} />}
                  </button>
                )
              })}
            </div>

            {method === "card" ? (
              <div className="mt-5 space-y-4">
                <Field label="Numéro de carte" icon={<CreditCard className="h-4 w-4" />}>
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
                <Field label="Nom sur la carte">
                  <input
                    autoComplete="cc-name"
                    placeholder="NOM PRÉNOM"
                    value={card.name}
                    onChange={(e) => setCard((c) => ({ ...c, name: e.target.value }))}
                    className="w-full bg-transparent text-sm font-semibold uppercase outline-none placeholder:text-[#e6fff1]/30"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Expiration">
                    <input
                      inputMode="numeric"
                      placeholder="MM/AA"
                      value={card.expiry}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "").slice(0, 4)
                        const formatted = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
                        setCard((c) => ({ ...c, expiry: formatted }))
                      }}
                      className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-[#e6fff1]/30"
                    />
                  </Field>
                  <Field label="CVC">
                    <input
                      inputMode="numeric"
                      placeholder="123"
                      value={card.cvc}
                      onChange={(e) => setCard((c) => ({ ...c, cvc: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                      className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-[#e6fff1]/30"
                    />
                  </Field>
                </div>
              </div>
            ) : (
              <div className="mt-5">
                <Field label="Numéro de téléphone" icon={<Smartphone className="h-4 w-4" />}>
                  <input
                    inputMode="tel"
                    placeholder="20 123 456"
                    value={phone}
                    onChange={(e) => setPhone((p) => e.target.value.replace(/[^\d+]/g, "").slice(0, 12))}
                    className="w-full bg-transparent text-sm font-semibold tracking-wide outline-none placeholder:text-[#e6fff1]/30"
                  />
                </Field>
                <p className="mt-2 rounded-xl bg-[#a7f3d0]/5 px-3 py-2 text-[11px] leading-relaxed text-[#e6fff1]/50">
                  Tu recevras une demande de confirmation {method === "flouci" ? "dans l'app Flouci" : "par SMS"} pour valider {price.priceTND}.
                </p>
              </div>
            )}

            {error && <p className="mt-4 text-center text-sm font-semibold text-red-400">{error}</p>}

            <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-[#e6fff1]/40">
              <Lock className="h-3.5 w-3.5" />
              Paiement sécurisé — démo, aucun débit réel
            </div>
          </div>

          <div className="border-t border-[#a7f3d0]/10 bg-secondary px-6 pb-8 pt-4">
            <button
              type="button"
              onClick={pay}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-extrabold text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-[0.98]"
            >
              <Lock className="h-4 w-4" />
              Payer {price.priceTND} — activer Premium
            </button>
          </div>
        </>
      )}

      {/* ---------- PROCESSING ---------- */}
      {step === "processing" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-10 text-center">
          <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary/15">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </span>
          <div>
            <p className="text-lg font-extrabold">Traitement du paiement…</p>
            <p className="mt-1 text-sm text-[#e6fff1]/50">Confirmation de {price.priceTND} en cours</p>
          </div>
        </div>
      )}

      {/* ---------- SUCCESS ---------- */}
      {step === "success" && (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center animate-pop-in">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-10 w-10" strokeWidth={3} />
          </span>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight">Tu es Premium ! 👑</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#e6fff1]/60">
            Scans illimités, coach IA et analyses avancées sont débloqués.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-8 w-full rounded-2xl bg-primary py-4 text-base font-extrabold text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-[0.98]"
          >
            Commencer
          </button>
        </div>
      )}

      {/* ---------- REDEEM ---------- */}
      {step === "redeem" && (
        <>
          <div className="flex-1 px-6 pt-2">
            <p className="text-sm leading-relaxed text-[#e6fff1]/60">
              Entre le code reçu (par SMS, en boutique ou lors d&apos;un événement) pour activer Premium.
            </p>
            <div className="mt-5">
              <Field label="Code d'activation" icon={<Ticket className="h-4 w-4" />}>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 40))}
                  placeholder="SAHTEK-XXXX-XXXX"
                  autoCapitalize="characters"
                  className="w-full bg-transparent text-sm font-extrabold uppercase tracking-widest outline-none placeholder:text-[#e6fff1]/30"
                />
              </Field>
            </div>
            {codeMsg && (
              <p className={cn("mt-4 text-center text-sm font-semibold", codeMsg.includes("mois") || codeMsg.includes("activé") ? "text-primary" : "text-red-400")}>
                {codeMsg}
              </p>
            )}
          </div>
          <div className="border-t border-[#a7f3d0]/10 bg-secondary px-6 pb-8 pt-4">
            <button
              type="button"
              onClick={() => void redeem()}
              disabled={busy || code.trim().length < 4}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-extrabold text-primary-foreground shadow-lg shadow-primary/30 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Ticket className="h-4 w-4" />}
              {busy ? "Vérification…" : "Activer mon code"}
            </button>
          </div>
        </>
      )}

      {/* ---------- MANAGE ---------- */}
      {step === "manage" && (
        <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-8">
          <div className="rounded-3xl bg-gradient-to-br from-primary/25 to-primary/5 p-6 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Crown className="h-7 w-7" />
            </span>
            <h2 className="mt-4 text-2xl font-extrabold tracking-tight">{isPremium ? "Premium actif" : "Abonnement en fin"}</h2>
            <p className="mt-1 text-sm text-[#e6fff1]/60">
              {isPremium ? `Renouvellement le ${formatDate(premium.renews)}` : `Accès jusqu'au ${formatDate(premium.cancelAt)}`}
            </p>
          </div>

          <div className="mt-5 rounded-2xl bg-[#a7f3d0]/5 p-4">
            <Row label="Formule" value={premium.plan ? PLANS[premium.plan].label : "—"} />
            <Row label="Prix" value={premium.plan ? `${PLANS[premium.plan].priceTND}${PLANS[premium.plan].per}` : "—"} />
            <Row label="Membre depuis" value={formatDate(premium.since)} />
            <Row label="Moyen de paiement" value={premium.cardLast4 ? `•••• ${premium.cardLast4}` : "—"} last />
          </div>

          <div className="mt-5 flex items-start gap-2 rounded-2xl bg-[#a7f3d0]/5 p-4 text-xs text-[#e6fff1]/50">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            Annule quand tu veux — tu gardes Premium jusqu&apos;à la fin de la période payée. Prix en dinar tunisien, sans frais cachés.
          </div>

          {isPremium ? (
            <button
              type="button"
              onClick={() => cancel()}
              className="mt-6 w-full rounded-2xl border border-[#a7f3d0]/15 py-3.5 text-sm font-bold text-[#e6fff1]/70 active:scale-[0.99]"
            >
              Annuler l&apos;abonnement
            </button>
          ) : (
            <button
              type="button"
              onClick={() => resume()}
              className="mt-6 w-full rounded-2xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground active:scale-[0.99]"
            >
              Réactiver l&apos;abonnement
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#e6fff1]/50">
        {icon}
        {label}
      </span>
      <span className="flex items-center rounded-xl border border-[#a7f3d0]/10 bg-[#a7f3d0]/5 px-4 py-3 focus-within:border-primary/60">{children}</span>
    </label>
  )
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between py-2", !last && "border-b border-[#a7f3d0]/10")}>
      <span className="text-sm text-[#e6fff1]/50">{label}</span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  )
}
