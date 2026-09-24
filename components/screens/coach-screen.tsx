"use client"

import { useEffect, useRef, useState } from "react"
import { X, Send, Sparkles, Loader2, Crown } from "lucide-react"
import { useAccount } from "@/lib/account"
import { useFoodLog, dayTotals } from "@/lib/food-log"
import { useHealth } from "@/lib/health"
import { usePremium } from "@/lib/premium"
import { useWeight } from "@/lib/weight"
import { useStreak } from "@/components/use-streak"
import { DERJA_SUGGESTIONS } from "@/lib/derja"
import { cn } from "@/lib/utils"

const FREE_DAILY_CHATS = 3
const CHAT_KEY = "sahtek.coach.chat.v1"
const QUOTA_KEY = "sahtek.coach.quota.v1"

type Msg = { role: "user" | "assistant"; content: string }

const SUGGESTIONS = [
  "Que manger avec mes kcal restantes ?",
  "Idée de dîner tunisien léger ?",
  "Comment atteindre mes protéines ?",
  "Motive-moi pour marcher aujourd'hui",
]

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

export function CoachScreen({ onClose }: { onClose: () => void }) {
  const { state: account, targets } = useAccount()
  const { state } = useFoodLog()
  const { today: health } = useHealth()
  const { isPremium } = usePremium()
  const weight = useWeight()
  const streak = useStreak()

  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usedToday, setUsedToday] = useState(0)
  const [tunisianMode, setTunisianMode] = useState(false) // 🇹🇳 derja toggle
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    try {
      const rawChat = localStorage.getItem(CHAT_KEY)
      const rawQuota = localStorage.getItem(QUOTA_KEY)
      if (rawChat) {
        const parsed = JSON.parse(rawChat) as Msg[]
        setMessages(parsed.slice(-20))
      }
      if (rawQuota) {
        const q = JSON.parse(rawQuota) as { date: string; used: number }
        setUsedToday(q.date === todayKey() ? q.used : 0)
      }
    } catch {
      // corrupted storage
    }
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, busy])

  const totals = dayTotals(state.meals)
  const eaten = Math.round(totals.calories)
  const remaining = Math.max(targets.calories - eaten, 0)

  const latestWeight = weight.entries[0]?.kg ?? account.weight
  const weightTrend =
    weight.entries.length >= 2
      ? (() => {
          const newest = weight.entries[0]
          const weekAgo = weight.entries.find((e) => (new Date(newest.date).getTime() - new Date(e.date).getTime()) / 86400000 >= 6)
          if (!weekAgo) return null
          return { latest: newest.kg, changePerWeek: (newest.kg - weekAgo.kg) / ((new Date(newest.date).getTime() - new Date(weekAgo.date).getTime()) / 7) }
        })()
      : null

  const send = async (text: string) => {
    const question = text.trim()
    if (!question || busy) return
    setError(null)
    const nextMessages = [...messages, { role: "user" as const, content: question }]
    setMessages(nextMessages)
    setInput("")
    setBusy(true)
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          context: {
            name: account.name.split(" ")[0],
            goal: account.goal,
            targetCalories: targets.calories,
            eaten,
            remaining,
            protein: { eaten: Math.round(totals.protein), target: targets.protein },
            water: { drunk: state.water, target: targets.water },
            steps: health.steps,
            workoutMinutes: health.workoutMinutes,
            streak,
            weightTrend,
            question,
          },
          freeChatUsed: usedToday,
          isPremium,
          lang: tunisianMode ? "tn" : undefined,
        }),
      })
      const data = (await res.json().catch(() => null)) as { answer?: string; error?: string; quota?: boolean; lang?: "fr" | "tn" } | null
      if (!res.ok || !data?.answer) {
        setError(data?.error ?? "Réponse indisponible — réessaie.")
        return
      }
      const finalMessages = [...nextMessages, { role: "assistant" as const, content: data.answer }]
      setMessages(finalMessages)
      if (!isPremium) {
        const used = usedToday + 1
        setUsedToday(used)
        localStorage.setItem(QUOTA_KEY, JSON.stringify({ date: todayKey(), used }))
      }
      try {
        localStorage.setItem(CHAT_KEY, JSON.stringify(finalMessages.slice(-20)))
      } catch {
        // storage full
      }
    } catch {
      setError("Connexion impossible — réessaie.")
    } finally {
      setBusy(false)
    }
  }

  const quotaLeft = isPremium ? null : Math.max(0, FREE_DAILY_CHATS - usedToday)

  return (
    <div className="safe-top absolute inset-0 z-30 flex flex-col bg-background animate-slide-up">
      {/* Colonne de lecture centrée sur tablette (ligne courte = lisible) */}
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-primary">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-extrabold leading-tight tracking-tight">Coach Sahtek</h1>
            <p className="text-xs text-muted-foreground">
              {isPremium ? "Illimité 👑" : quotaLeft === 0 ? "Quota du jour épuisé" : `${quotaLeft} question${quotaLeft! > 1 ? "s" : ""} restante${quotaLeft! > 1 ? "s" : ""} aujourd'hui`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTunisianMode((v) => !v)}
            aria-pressed={tunisianMode}
            aria-label="Mode derja tunisienne"
            title="Réponds en derja tunisienne 🇹🇳"
            className={cn(
              "flex h-9 items-center gap-1 rounded-full px-2.5 text-sm font-extrabold transition-all active:scale-90",
              tunisianMode ? "bg-primary/25 text-primary ring-2 ring-primary/50" : "bg-muted text-muted-foreground",
            )}
          >
            🇹🇳
          </button>
          <button type="button" onClick={onClose} aria-label="Fermer le coach" className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto no-scrollbar px-5 pb-4 sm:px-6">
        {messages.length === 0 && (
          <div className="mt-6 rounded-3xl border border-[#a7f3d0]/10 bg-card p-5 text-center">
            <span className="text-4xl">🧠</span>
            <p className="mt-3 font-extrabold">{tunisianMode ? "سولني، نعرف نهارك متاعك" : "Pose ta question, je connais ta journée"}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {tunisianMode
                ? "A7kili bel derja — nchouf el kcal el ba9iya, el protéines, el ma w el pas mta3ek w ngoulek chnowa ta3mel."
                : "Je vois tes " + remaining + " kcal restantes, tes protéines, ton eau, tes pas et ton streak — demande-moi quoi en faire."}
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-relaxed",
                m.role === "user"
                  ? "rounded-br-lg bg-primary text-primary-foreground font-semibold"
                  : "rounded-bl-lg border border-[#a7f3d0]/10 bg-card",
              )}
            >
              <MarkdownLite text={m.content} />
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-3xl rounded-bl-lg border border-[#a7f3d0]/10 bg-card px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" /> Le coach réfléchit…
            </div>
          </div>
        )}
        {error && <p className="text-center text-sm font-semibold text-destructive">{error}</p>}
        <div ref={endRef} />
      </div>

      {/* Suggestions */}
      {messages.length === 0 && !busy && (
        <div className="flex snap-x gap-2 overflow-x-auto no-scrollbar px-5 pb-2 sm:px-6">
          {(tunisianMode
            ? DERJA_SUGGESTIONS.map((s) => ({ label: s.label, question: s.question }))
            : SUGGESTIONS.map((s) => ({ label: s, question: s }))
          ).map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => void send(s.question)}
              className="shrink-0 snap-start rounded-full border border-[#a7f3d0]/15 bg-card px-3.5 py-2 text-xs font-bold text-muted-foreground active:scale-95"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Quota nudge for free users */}
      {!isPremium && quotaLeft === 0 && (
        <div className="mx-5 mb-2 flex items-center gap-2 rounded-2xl bg-accent p-3 text-xs font-semibold text-accent-foreground sm:mx-6">
          <Crown className="h-4 w-4 shrink-0 text-primary" />
          Passe Premium pour un coach illimité.
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border bg-card px-4 pb-8 pt-3 sm:px-6 sm:pb-10">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void send(input)
          }}
          className="flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={quotaLeft === 0 ? "Reviens demain ou passe Premium…" : tunisianMode ? "سولني بالدرجة… 🇹🇳" : "Ta question…"}
            disabled={busy || quotaLeft === 0}
            maxLength={500}
            className="flex-1 rounded-2xl bg-muted px-4 py-3 text-sm font-medium outline-none placeholder:text-muted-foreground disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={busy || !input.trim() || quotaLeft === 0}
            aria-label="Envoyer"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground disabled:opacity-40 active:scale-90"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      </div>
      </div>
    </div>
  )
}

/** Renders **bold** and line breaks — enough for coach answers. */
function MarkdownLite({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <b key={i}>{p.slice(2, -2)}</b>
        ) : (
          <span key={i} className="whitespace-pre-wrap">
            {p}
          </span>
        ),
      )}
    </>
  )
}
