"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { X, Trophy, Users, Plus, ChefHat, Medal, Flame, Footprints, Droplets, Trash2, Check, Loader2, Heart, Share2, Sparkles } from "lucide-react"
import { useSync } from "@/lib/sync"
import { useAccount } from "@/lib/account"
import { useFoodLog } from "@/lib/food-log"
import { useHealth } from "@/lib/health"
import { useStreak } from "@/components/use-streak"
import { shareLink, nativeShare, openInstagramStory, openTikTok } from "@/lib/share"
import { cn } from "@/lib/utils"

type Recipe = {
  id: string
  userId: string
  authorName: string
  title: string
  description: string
  calories: number
  protein: number
  carbs: number
  fat: number
  emoji: string
  createdAt: number
  likes?: number
  likedByMe?: boolean
}

type Challenge = {
  key: string
  name: string
  desc: string
  emoji: string
  accent: string
  goalPoints: number
}

const CHALLENGES: Challenge[] = [
  { key: "ramadan-2026", name: "Ramadan Challenge", desc: "10 jours de repas équilibrés et hydratation entre le ftour et le ksour.", emoji: "🌙", accent: "bg-accent text-primary", goalPoints: 30 },
  { key: "steps-tunisia", name: "10 000 pas / jour", desc: "Marche quotidienne — chaque jour atteint rapporte des points.", emoji: "🚶", accent: "bg-steps-soft text-steps", goalPoints: 20 },
  { key: "protein-club", name: "Club Protéines", desc: "Atteins ton objectif protéines 7 jours d'affilée.", emoji: "💪", accent: "bg-protein-soft text-protein", goalPoints: 15 },
]

type BadgeDef = { key: string; label: string; emoji: string; earned: boolean; hint: string }

export function CommunityScreen({ onClose }: { onClose: () => void }) {
  const { user } = useSync()
  const { state: account, targets } = useAccount()
  const { state, history } = useFoodLog()
  const { state: health, today: todayHealth } = useHealth()
  const streak = useStreak()

  const [tab, setTab] = useState<"challenges" | "recipes">("challenges")
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [leaderboard, setLeaderboard] = useState<{ userId: string; name: string; points: number }[]>([])
  const [myPoints, setMyPoints] = useState<Record<string, number>>({})
  const [joined, setJoined] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showComposer, setShowComposer] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [form, setForm] = useState({ title: "", description: "", calories: "", protein: "", carbs: "", fat: "", emoji: "🥗" })
  const [addedRecipe, setAddedRecipe] = useState<string | null>(null)
  const [sharing, setSharing] = useState<string | null>(null)
  const [likeState, setLikeState] = useState<Record<string, { liked: boolean; total: number }>>({})

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/community?challenge=ramadan-2026", { cache: "no-store" })
      const data = (await res.json().catch(() => null)) as
        | { recipes?: Recipe[]; leaderboard?: { userId: string; name: string; points: number }[]; myProgress?: { challengeKey: string; points: number }[]; myJoins?: string[] }
        | null
      setRecipes(data?.recipes ?? [])
      setLikeState(Object.fromEntries((data?.recipes ?? []).map((r) => [r.id, { liked: r.likedByMe ?? false, total: r.likes ?? 0 }])))
      setLeaderboard(data?.leaderboard ?? [])
      setMyPoints(Object.fromEntries((data?.myProgress ?? []).map((p) => [p.challengeKey, p.points])))
      setJoined(data?.myJoins ?? [])
    } catch {
      // offline — keep whatever we have
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  /** Real points from the user's actual day: logged under goal, steps hit, water hit, workout, streak. */
  const claimDailyPoints = async (c: Challenge) => {
    if (!user || !joined.includes(c.key)) return
    const totalsKcal = Object.values(state.meals).flat().length > 0
    const waterHit = state.water >= targets.water
    const stepsHit = todayHealth.steps >= account.stepGoal
    const workoutHit = todayHealth.workoutMinutes >= 15
    const underGoal = totalsKcal && Object.values(state.meals).some((m) => m.length > 0)
    let pts = 0
    if (underGoal) pts += 1
    if (waterHit) pts += 1
    if (stepsHit) pts += 1
    if (workoutHit) pts += 1
    if (pts === 0) {
      setFormError("Logge au moins un repas aujourd'hui pour marquer des points.")
      window.setTimeout(() => setFormError(null), 2500)
      return
    }
    await fetch("/api/community", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "points", challenge: c.key, points: Math.min(4, pts) }),
    })
    await refresh()
  }

  const join = async (key: string) => {
    if (!user) return
    await fetch("/api/community", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "join", challenge: key }),
    })
    await refresh()
  }

  const shareRecipe = async () => {
    setBusy(true)
    setFormError(null)
    try {
      const res = await fetch("/api/community", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "recipe",
          title: form.title,
          description: form.description,
          calories: Number(form.calories) || 0,
          protein: Number(form.protein) || 0,
          carbs: Number(form.carbs) || 0,
          fat: Number(form.fat) || 0,
          emoji: form.emoji,
        }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        setFormError(data?.error ?? "Impossible de partager la recette")
        return
      }
      setShowComposer(false)
      setForm({ title: "", description: "", calories: "", protein: "", carbs: "", fat: "", emoji: "🥗" })
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const removeRecipe = async (id: string) => {
    await fetch("/api/community", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "delete-recipe", id }),
    })
    await refresh()
  }

  const toggleLike = async (r: Recipe) => {
    const prev = likeState[r.id] ?? { liked: false, total: 0 }
    // optimistic update
    setLikeState((s) => ({ ...s, [r.id]: { liked: !prev.liked, total: prev.total + (prev.liked ? -1 : 1) } }))
    try {
      const res = await fetch("/api/community", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "like", id: r.id }),
      })
      const data = (await res.json().catch(() => null)) as { liked?: boolean; total?: number } | null
      if (res.ok && data) {
        setLikeState((s) => ({ ...s, [r.id]: { liked: !!data.liked, total: data.total ?? 0 } }))
      }
    } catch {
      setLikeState((s) => ({ ...s, [r.id]: prev })) // revert
    }
  }

  /** Generates a branded share card (canvas, Sahtek logo + macros) and opens the Instagram / share sheet. */
  /** Carte story 1080×1920 (Instagram/TikTok) + partage Web Share ou téléchargement. */
  const shareStoryCard = async (r: Recipe, target: "share" | "insta" | "tiktok") => {
    setSharing(r.id)
    try {
      const canvas = document.createElement("canvas")
      canvas.width = 1080
      canvas.height = 1920
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("no canvas")

      // Fond aurora sombre vertical
      const bg = ctx.createLinearGradient(0, 0, 1080, 1920)
      bg.addColorStop(0, "#0b0f0d")
      bg.addColorStop(0.55, "#0d1f15")
      bg.addColorStop(1, "#07130d")
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, 1080, 1920)
      const glow = ctx.createRadialGradient(880, 220, 0, 880, 220, 800)
      glow.addColorStop(0, "rgba(52, 211, 153, 0.35)")
      glow.addColorStop(1, "rgba(52, 211, 153, 0)")
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, 1080, 1920)

      // Header : logo SAHTEK
      ctx.fillStyle = "#34d399"
      roundRect(ctx, 84, 96, 88, 88, 24)
      ctx.fill()
      ctx.font = "bold 56px system-ui, sans-serif"
      ctx.fillStyle = "#06130c"
      ctx.fillText("🌿", 100, 160)
      ctx.fillStyle = "#e6fff1"
      ctx.font = "bold 52px system-ui, sans-serif"
      ctx.fillText("SAHTEK", 196, 158)
      ctx.fillStyle = "#8fb5a3"
      ctx.font = "28px system-ui, sans-serif"
      ctx.fillText("Ton coach nutrition tunisien", 196, 198)

      // Carte emoji centrale
      ctx.fillStyle = "rgba(255,255,255,0.05)"
      roundRect(ctx, 84, 360, 912, 620, 48)
      ctx.fill()
      ctx.textAlign = "center"
      ctx.font = "300px system-ui, sans-serif"
      ctx.fillText(r.emoji, 540, 640)

      // Titre
      ctx.fillStyle = "#e6fff1"
      ctx.font = "bold 68px system-ui, sans-serif"
      const title = r.title.length > 26 ? r.title.slice(0, 25) + "…" : r.title
      ctx.fillText(title, 540, 1120)

      // Macros
      ctx.font = "bold 44px system-ui, sans-serif"
      ctx.fillStyle = "#fdba74"
      ctx.fillText(`${r.calories} kcal`, 540, 1210)
      ctx.font = "bold 38px system-ui, sans-serif"
      ctx.fillStyle = "#93c5fd"
      ctx.fillText(`P${r.protein}g`, 330, 1290)
      ctx.fillStyle = "#fcd34d"
      ctx.fillText(`C${r.carbs}g`, 540, 1290)
      ctx.fillStyle = "#c4b5fd"
      ctx.fillText(`F${r.fat}g`, 750, 1290)

      // Auteur + CTA + lien
      ctx.fillStyle = "#a7f3d0"
      ctx.font = "36px system-ui, sans-serif"
      ctx.fillText(`Recette partagée par ${r.authorName} 💚`, 540, 1560)
      ctx.fillStyle = "#8fb5a3"
      ctx.font = "30px system-ui, sans-serif"
      ctx.fillText("Télécharge Sahtek 🌿", 540, 1630)
      ctx.fillStyle = "#34d399"
      ctx.font = "bold 32px system-ui, sans-serif"
      const link = shareLink("recipe", { title: r.title, calories: r.calories, protein: r.protein, carbs: r.carbs, fat: r.fat, emoji: r.emoji })
      const short = link.replace(/^https?:\/\//, "")
      ctx.fillText(short.length > 44 ? short.slice(0, 43) + "…" : short, 540, 1700)

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 0.92))
      if (!blob) throw new Error("blob")
      const file = new File([blob], `sahtek-${r.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-story.png`, { type: "image/png" })

      // 1) Partage natif avec fichier — Android propose directement Instagram/TikTok Stories dans la sheet.
      const nav = navigator as Navigator & { canShare?: (d: { files?: File[] }) => boolean }
      if (target === "share" && nav.canShare && nav.share) {
        const data = { files: [file], title: r.title, text: `${r.title} — recette healthy partagée sur Sahtek 🌿\n${link}` }
        if (nav.canShare(data)) {
          await nav.share(data)
          return
        }
      }
      // 2) Cible explicite : télécharger la carte puis ouvrir l'app story correspondante.
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = file.name
      a.click()
      URL.revokeObjectURL(url)
      if (target === "insta") await openInstagramStory()
      if (target === "tiktok") await openTikTok()
      // 3) Copie le lien de partage dans le presse-papiers (collable en légende).
      await navigator.clipboard.writeText(link).catch(() => {})
    } catch {
      // share cancelled or unsupported — silent
    } finally {
      setSharing(null)
    }
  }

  /** Inviter un ami : partage le lien /share (kind=app) via Web Share / presse-papiers. */
  const shareRecipeLink = async () => {
    const link = shareLink("recipe", { title: "Recettes healthy tunisiennes" })
    await nativeShare({ title: "Sahtek 🌿", text: "Rejoins-moi sur Sahtek et partage tes recettes healthy tunisiennes 🇹🇳", url: link })
  }

  /** Invitation large (tous moyens) : lien /share avec le prénom de l'utilisateur. */
  const inviteFriends = async () => {
    const link = shareLink("app", { name: user?.name ?? "Un ami" })
    await nativeShare({ title: "Sahtek 🇹🇳", text: "Je suis mon objectif nutrition sur Sahtek — rejoins-moi, on se défie 💪\n", url: link })
  }

  /** Quick-add a community recipe to the right meal (reuses the food log engine). */
  const quickAddRecipe = (r: Recipe) => {
    const { addFood } = foodLogApi
    const h = new Date().getHours()
    const meal = h < 11 ? "breakfast" : h < 16 ? "lunch" : h < 22 ? "dinner" : "snacks"
    addFood(meal, {
      id: `community_${r.id}`,
      name: r.title,
      serving: "1 portion",
      calories: r.calories,
      protein: r.protein,
      carbs: r.carbs,
      fat: r.fat,
      emoji: r.emoji,
    })
    setAddedRecipe(r.id)
    window.setTimeout(() => setAddedRecipe(null), 1500)
  }

  const badges: BadgeDef[] = useMemo(
    () => [
      { key: "streak-3", label: "Série de 3", emoji: "🔥", earned: streak >= 3, hint: `Streak actuel : ${streak}` },
      { key: "streak-7", label: "Semaine parfaite", emoji: "🏆", earned: streak >= 7, hint: `Streak actuel : ${streak}` },
      { key: "hydrated", label: "Bien hydraté", emoji: "💧", earned: state.water >= targets.water, hint: `${state.water}/${targets.water} verres` },
      { key: "mover", label: "En mouvement", emoji: "👣", earned: todayHealth.steps >= account.stepGoal, hint: `${todayHealth.steps.toLocaleString()} pas` },
      { key: "logger", label: "Journal tenu", emoji: "📔", earned: history.length >= 7, hint: `${history.length} jours loggés` },
      { key: "chef", label: "Chef communautaire", emoji: "👩‍🍳", earned: recipes.some((r) => r.userId === user?.id), hint: "Partage une recette" },
    ],
    [streak, state.water, todayHealth.steps, account.stepGoal, targets.water, history.length, recipes, user?.id],
  )

  const myRank = leaderboard.findIndex((l) => l.userId === user?.id) + 1

  return (
    <div className="safe-top absolute inset-0 z-30 flex flex-col bg-background animate-slide-up sm:mx-auto sm:max-w-2xl sm:border-x sm:border-[#a7f3d0]/10 sm:shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-primary">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-extrabold leading-tight tracking-tight">Communauté</h1>
            <p className="text-xs text-muted-foreground">Défis, badges & recettes tunisiennes</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer la communauté"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="mx-5 mb-1 grid grid-cols-2 rounded-2xl bg-muted p-1 sm:mx-6">
        {(["challenges", "recipes"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-xl py-2 text-sm font-bold transition-all",
              tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            {t === "challenges" ? "🏆 Défis" : "🥗 Recettes"}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar px-5 pb-8 sm:px-6">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </div>
        )}

        {!loading && tab === "challenges" && (
          <>
            <button
              type="button"
              onClick={() => void inviteFriends()}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 py-3.5 text-sm font-extrabold text-[#e6fff1] ring-1 ring-[#a7f3d0]/15 active:scale-[0.98]"
            >
              <Users className="h-4 w-4 text-primary" /> Inviter des amis — défiez-les 🔥
            </button>

            {/* Badges */}
            <section className="mt-4 rounded-3xl border border-[#a7f3d0]/10 bg-card p-4 shadow-sm">
              <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold">
                <Medal className="h-4 w-4 text-primary" /> Tes badges
              </h2>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
                {badges.map((b) => (
                  <div
                    key={b.key}
                    title={b.hint}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-2xl border p-3 text-center transition-all",
                      b.earned ? "border-primary/40 bg-primary/10" : "border-border bg-muted/40 opacity-50",
                    )}
                  >
                    <span className="text-2xl">{b.emoji}</span>
                    <span className="text-[10px] font-bold leading-tight">{b.label}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Challenges + leaderboard */}
            {CHALLENGES.map((c) => {
              const pts = myPoints[c.key] ?? 0
              const isJoined = joined.includes(c.key)
              const pct = Math.min((pts / c.goalPoints) * 100, 100)
              return (
                <section key={c.key} className="mt-4 rounded-3xl border border-[#a7f3d0]/10 bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl", c.accent)}>
                        {c.emoji}
                      </span>
                      <div className="min-w-0">
                        <p className="font-extrabold leading-tight">{c.name}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{c.desc}</p>
                      </div>
                    </div>
                    {isJoined ? (
                      <button
                        type="button"
                        onClick={() => void claimDailyPoints(c)}
                        className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-extrabold text-primary-foreground active:scale-95"
                      >
                        <Flame className="mr-1 inline h-3.5 w-3.5" />
                        + points
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void join(c.key)}
                        disabled={!user}
                        className="shrink-0 rounded-xl border border-primary/40 px-3 py-2 text-xs font-extrabold text-primary active:scale-95 disabled:opacity-40"
                      >
                        Rejoindre
                      </button>
                    )}
                  </div>

                  {isJoined && (
                    <>
                      <div className="mt-3 flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-700" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-extrabold tabular-nums">{pts}/{c.goalPoints}</span>
                      </div>

                      {/* Leaderboard */}
                      {c.key === "ramadan-2026" && leaderboard.length > 0 && (
                        <div className="mt-3 rounded-2xl bg-muted/40 p-3">
                          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                            <Trophy className="h-3.5 w-3.5 text-primary" /> Classement
                            {myRank > 0 && <span className="ml-auto text-primary">#{myRank} toi</span>}
                          </p>
                          <div className="flex flex-col gap-1.5">
                            {leaderboard.slice(0, 5).map((l, i) => (
                              <div key={l.userId} className={cn("flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm", l.userId === user?.id && "bg-primary/10")}>
                                <span className="w-6 text-center text-xs font-black">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
                                <span className="min-w-0 flex-1 truncate font-bold">{l.userId === user?.id ? "Toi" : l.name}</span>
                                <span className="text-xs font-extrabold tabular-nums text-primary">{l.points} pts</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </section>
              )
            })}
          </>
        )}

        {!loading && tab === "recipes" && (
          <>
            <button
              type="button"
              onClick={() => setShowComposer(true)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-extrabold text-primary-foreground shadow-lg shadow-primary/25 active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} /> Partager une recette healthy
            </button>

            <button
              type="button"
              onClick={() => void shareRecipeLink()}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#a7f3d0]/15 bg-card py-3 text-sm font-extrabold text-[#e6fff1] active:scale-[0.98]"
            >
              <Share2 className="h-4 w-4 text-primary" /> Inviter un ami à ajouter sa recette
            </button>

            {recipes.length === 0 && (
              <div className="mt-8 rounded-3xl border border-dashed border-border p-8 text-center">
                <ChefHat className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-3 text-sm font-bold">Aucune recette encore partagée</p>
                <p className="mt-1 text-xs text-muted-foreground">Sois la première personne à partager ton plat tunisien light !</p>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-3">
              {recipes.map((r) => {
                const like = likeState[r.id] ?? { liked: false, total: 0 }
                return (
                <article key={r.id} className="rounded-3xl border border-[#a7f3d0]/10 bg-card p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-muted text-2xl">{r.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-extrabold leading-tight">{r.title}</p>
                        {r.userId === user?.id && (
                          <button
                            type="button"
                            onClick={() => void removeRecipe(r.id)}
                            aria-label="Supprimer ma recette"
                            className="shrink-0 text-muted-foreground active:scale-90"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] font-semibold text-primary">{r.authorName}</p>
                      <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{r.description}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="rounded-lg bg-calories-soft px-2 py-1 text-[11px] font-extrabold text-calories">{r.calories} kcal</span>
                    <span className="rounded-lg bg-protein-soft px-2 py-1 text-[11px] font-extrabold text-protein">P{r.protein}</span>
                    <span className="rounded-lg bg-carbs-soft px-2 py-1 text-[11px] font-extrabold text-carbs">C{r.carbs}</span>
                    <span className="rounded-lg bg-fat-soft px-2 py-1 text-[11px] font-extrabold text-fat">F{r.fat}</span>
                    <button
                      type="button"
                      onClick={() => quickAddRecipe(r)}
                      className={cn(
                        "ml-auto flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-extrabold active:scale-95",
                        addedRecipe === r.id ? "bg-primary/20 text-primary" : "bg-primary text-primary-foreground",
                      )}
                    >
                      {addedRecipe === r.id ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Plus className="h-3.5 w-3.5" strokeWidth={3} />}
                      {addedRecipe === r.id ? "Ajouté !" : "Ajouter"}
                    </button>
                  </div>
                  {/* Likes + Instagram share card */}
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                    <button
                      type="button"
                      onClick={() => void toggleLike(r)}
                      aria-label={like.liked ? "Retirer mon like" : "Liker cette recette"}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold transition-all active:scale-90",
                        like.liked ? "bg-rose-500/15 text-rose-400" : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Heart className={cn("h-4 w-4", like.liked && "fill-current")} strokeWidth={2.5} />
                      {like.total > 0 ? like.total : "Like"}
                    </button>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void shareStoryCard(r, "insta")}
                        aria-label="Générer la carte story Instagram (1080×1920)"
                        title="Story Instagram — carte téléchargée puis Instagram s'ouvre"
                        className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-fuchsia-500/15 to-amber-400/15 px-3 py-1.5 text-xs font-extrabold text-[#e6fff1]/80 active:scale-90"
                      >
                        {sharing === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        Story
                      </button>
                      <button
                        type="button"
                        onClick={() => void shareStoryCard(r, "tiktok")}
                        aria-label="Générer la carte story TikTok"
                        title="Story TikTok — carte téléchargée puis TikTok s'ouvre"
                        className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-500/15 to-fuchsia-500/15 px-3 py-1.5 text-xs font-extrabold text-[#e6fff1]/80 active:scale-90"
                      >
                        🎵
                      </button>
                    </div>
                  </div>
                </article>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Composer */}
      {showComposer && (
        <div className="safe-top absolute inset-0 z-10 flex flex-col bg-background animate-slide-up sm:mx-auto sm:max-w-2xl sm:border-x sm:border-[#a7f3d0]/10 sm:shadow-2xl">
          <div className="flex items-center justify-between px-5 py-3 sm:px-6">
            <h2 className="text-lg font-extrabold">Partager une recette</h2>
            <button
              type="button"
              onClick={() => setShowComposer(false)}
              aria-label="Annuler"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar px-5 pb-8 sm:px-6">
            <div className="flex gap-2">
              {["🥗", "🍲", "🐟", "🥘", "🍳", "🫑", "🍗", "🥙"].map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, emoji: e }))}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-xl text-xl transition-all",
                    form.emoji === e ? "bg-primary/20 ring-2 ring-primary" : "bg-muted",
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
            <L label="Nom du plat">
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Salade mechouia light"
                maxLength={80}
                className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground"
              />
            </L>
            <L label="Recette (ingrédients & préparation)">
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Tomates grillées, poivrons, oignon, 1 c.à.s huile d'olive, thon au naturel…"
                rows={4}
                maxLength={400}
                className="w-full resize-none bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
              />
            </L>
            <div className="grid grid-cols-4 gap-2">
              {([
                ["calories", "kcal"],
                ["protein", "P (g)"],
                ["carbs", "C (g)"],
                ["fat", "F (g)"],
              ] as const).map(([k, label]) => (
                <L key={k} label={label}>
                  <input
                    value={form[k]}
                    onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                    inputMode="numeric"
                    placeholder="0"
                    className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-muted-foreground"
                  />
                </L>
              ))}
            </div>
            {formError && <p className="text-center text-sm font-semibold text-destructive">{formError}</p>}
          </div>
          <div className="border-t border-border bg-card px-5 pt-4 sm:px-6 sm:pb-10" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}>
            <button
              type="button"
              onClick={() => void shareRecipe()}
              disabled={busy || form.title.trim().length < 3 || form.description.trim().length < 10}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-extrabold text-primary-foreground shadow-lg shadow-primary/30 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" strokeWidth={3} />}
              {busy ? "Envoi…" : "Partager avec la communauté"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Canvas rounded-rect helper for the Instagram share card. */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Access to the food log for quick-adds (same engine as the rest of the app). */
let foodLogApi: ReturnType<typeof useFoodLog>
export function CommunityFoodLogBridge() {
  foodLogApi = useFoodLog()
  return null
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="flex items-center rounded-2xl border border-[#a7f3d0]/10 bg-card px-4 py-3 focus-within:border-primary/60">{children}</span>
    </label>
  )
}
