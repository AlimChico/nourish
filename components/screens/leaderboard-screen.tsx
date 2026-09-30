"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { X, Trophy, Loader2, RefreshCw, Flame, Medal, Users } from "lucide-react"
import { useSync } from "@/lib/sync"
import { useXp } from "@/components/use-xp"
import { levelForXp, MAX_DAILY_XP, XP_PER_ENTRY } from "@/lib/xp"
import { cn } from "@/lib/utils"

type Row = {
  rank: number
  name: string
  initials: string
  xp: number
  level: number
  title: string
  streak: number
  isMe: boolean
}

type Payload = { updatedAt: number; total: number; me: Row | null; entries: Row[] }

/** Rafraîchissement périodique (le classement bouge lentement : 45 s suffit). */
const POLL_MS = 45_000

function medalFor(rank: number): string {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : ""
}

function initialsOr(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "S"
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("")
}

export function LeaderboardScreen({ onClose }: { onClose: () => void }) {
  const { status } = useSync()
  const xp = useXp()

  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const lastFetch = useRef(0)
  const hasData = useRef(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setRefreshing(true)
    try {
      const res = await fetch("/api/leaderboard", { cache: "no-store" })
      if (res.status === 401) {
        setData(null)
        setError("auth")
        return
      }
      if (!res.ok) throw new Error(String(res.status))
      const payload = (await res.json()) as Payload
      setData(payload)
      hasData.current = true
      setError(null)
      lastFetch.current = Date.now()
    } catch {
      // Hors-ligne : on garde la dernière liste connue si on en a une.
      if (!hasData.current) setError("offline")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Mise à jour périodique, uniquement quand l'écran est visible : pas de
  // requêtes en arrière-plan sur un téléphone verrouillé.
  useEffect(() => {
    if (status !== "authed") return
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true)
    }, POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastFetch.current > POLL_MS) void load(true)
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [status, load])

  const entries = data?.entries ?? []
  const me = data?.me ?? null
  /**
   * Valeur affichée dans la carte du haut : celle du classement (serveur) dès
   * qu'elle est connue — sinon celle calculée localement. Sans ça, un appareil
   * re-synchronisé pourrait afficher deux totaux d'XP différents sur le MÊME
   * écran (la carte en local, la liste en serveur).
   */
  const mine = me ? { totalXp: me.xp, level: levelForXp(me.xp) } : { totalXp: xp.totalXp, level: xp.level }

  return (
    <div className="safe-top absolute inset-0 z-30 flex flex-col bg-background aurora-glow animate-slide-up sm:mx-auto sm:max-w-2xl sm:border-x sm:border-[#a7f3d0]/10 sm:shadow-2xl">
      {/* En-tête */}
      <div className="flex items-center justify-between px-5 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-primary">
            <Trophy className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-extrabold leading-tight tracking-tight">Leaderboard</h1>
            <p className="text-xs text-muted-foreground">
              {data ? `${data.total} Sahtek player${data.total > 1 ? "s" : ""} ranked` : "Ranked by XP"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load(true)}
            aria-label="Rafraîchir le classement"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
          >
            <RefreshCw className={cn("h-4.5 w-4.5", refreshing && "animate-spin")} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le classement"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar px-4 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] sm:px-6">
        {/* Mon niveau — toujours calculé en local, donc visible même hors-ligne */}
        <section className="surface-dark rounded-3xl border border-[#a7f3d0]/12 bg-gradient-to-b from-[#11251b] to-[#0d1a13] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Your level</p>
              <p className="truncate text-xl font-extrabold tracking-tight">
                Level {mine.level.level} · {mine.level.title}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-2xl font-extrabold tabular-nums text-primary">{mine.totalXp.toLocaleString()}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">total XP</p>
            </div>
          </div>

          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[#0a1410] ring-1 ring-inset ring-[#a7f3d0]/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-[#a7f3d0] transition-[width] duration-700"
              style={{ width: `${Math.round(Math.max(0.02, mine.level.progress) * 100)}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
            <span className="tabular-nums">
              {mine.level.intoLevel} / {mine.level.forNext} XP to level {mine.level.level + 1}
            </span>
            <span className="tabular-nums text-primary">+{xp.todayXp} XP today</span>
          </div>

          {me && (
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-[#0a1410]/70 px-3 py-2">
              <span className="text-xs font-semibold text-muted-foreground">Your rank</span>
              <span className="text-sm font-extrabold tabular-nums text-primary">
                {me.rank}
                <span className="text-muted-foreground"> / {data?.total ?? 1}</span>
              </span>
            </div>
          )}
        </section>

        {/* État : non connecté (ou session expirée côté serveur) */}
        {(status !== "authed" || error === "auth") && (
          <div className="mt-4 rounded-3xl border border-[#a7f3d0]/10 bg-card p-5 text-center shadow-sm">
            <span className="text-3xl">🔒</span>
            <p className="mt-2 text-base font-extrabold">Sign in to join the ranking</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your XP is already being counted on this device. Create an account (or sign in) to appear in the
              leaderboard — only your name, level and XP are shared, never your meals.
            </p>
          </div>
        )}

        {/* État : erreur réseau, liste déjà connue */}
        {status === "authed" && error === "offline" && !data && (
          <div className="mt-4 rounded-3xl border border-[#fbbf24]/25 bg-[#2a2410] p-5 text-center">
            <span className="text-3xl">📡</span>
            <p className="mt-2 text-base font-extrabold">Leaderboard unavailable</p>
            <p className="mt-1 text-sm text-[#fde68a]">
              No connection right now. Your XP keeps growing locally — the ranking will load as soon as you&apos;re
              back online.
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              Try again
            </button>
          </div>
        )}

        {/* Chargement initial */}
        {status === "authed" && error !== "auth" && loading && !data && (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-3xl border border-[#a7f3d0]/10 bg-card p-6 text-sm font-semibold text-muted-foreground shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading the ranking…
          </div>
        )}

        {/* Classement */}
        {entries.length > 0 && (
          <ul className="mt-4 space-y-2">
            {entries.map((row) => (
              <li
                key={`${row.rank}-${row.name}`}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border p-3 shadow-sm",
                  row.isMe
                    ? "border-primary/40 bg-primary/10 ring-1 ring-primary/30"
                    : "border-[#a7f3d0]/10 bg-card",
                )}
              >
                <span className="w-8 shrink-0 text-center text-sm font-extrabold tabular-nums text-muted-foreground">
                  {medalFor(row.rank) || row.rank}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
                    row.rank === 1
                      ? "bg-primary text-primary-foreground"
                      : row.rank <= 3
                        ? "bg-[#a7f3d0]/25 text-primary"
                        : "bg-muted text-foreground",
                  )}
                >
                  {initialsOr(row.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">
                    {row.name}
                    {row.isMe && <span className="ml-1.5 text-[10px] font-extrabold text-primary">YOU</span>}
                  </p>
                  <p className="flex items-center gap-2 truncate text-[11px] font-semibold text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Medal className="h-3 w-3" />
                      Lv {row.level} · {row.title}
                    </span>
                    {row.streak > 1 && (
                      <span className="inline-flex items-center gap-0.5 text-[#fbbf24]">
                        <Flame className="h-3 w-3" />
                        {row.streak}
                      </span>
                    )}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-extrabold tabular-nums text-primary">
                  {row.xp.toLocaleString()}
                  <span className="ml-0.5 text-[10px] font-bold text-muted-foreground">XP</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Aucun joueur classé */}
        {status === "authed" && !loading && !error && entries.length === 0 && (
          <div className="mt-4 rounded-3xl border border-[#a7f3d0]/10 bg-card p-6 text-center shadow-sm">
            <span className="text-3xl">🚀</span>
            <p className="mt-2 text-base font-extrabold">Be the first on the board</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Log a meal to earn {XP_PER_ENTRY} XP. Nobody is ranked yet — the first logged day takes the crown.
            </p>
          </div>
        )}

        {/* Les règles, en clair : pas de score magique */}
        <section className="mt-4 rounded-2xl border border-[#a7f3d0]/10 bg-accent p-4">
          <p className="flex items-center gap-1.5 text-sm font-extrabold">
            <Users className="h-4 w-4 text-primary" />
            How XP works
          </p>
          <ul className="mt-2 space-y-1 text-xs font-semibold text-accent-foreground">
            <li>• +{XP_PER_ENTRY} XP per food logged (max 10 counted per day)</li>
            <li>• +20 XP bonus for a complete day (3 foods or more)</li>
            <li>• +5 XP per day of your streak (up to +50)</li>
            <li>• {MAX_DAILY_XP} XP per day maximum — logging 40 foods changes nothing</li>
          </ul>
          <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
            {data ? `Updated ${new Date(data.updatedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} · refreshes every 45 s` : "Updates automatically"}
          </p>
        </section>
      </div>
    </div>
  )
}
