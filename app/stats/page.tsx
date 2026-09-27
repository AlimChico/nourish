"use client"

import { useCallback, useEffect, useState } from "react"

const KEY_STORE = "sahtek.adminkey.v1"

type Stats = {
  backend: string
  total: number
  today: number
  days7: { visits: number; visitors: number; users: number }
  daily: { day: string; visits: number; visitors: number; users: number }[]
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-black tabular-nums text-primary">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  )
}

export default function StatsPage() {
  const [input, setInput] = useState("")
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (key: string) => {
    if (!key) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/stats", { headers: { "x-admin-key": key } })
      if (res.status === 401) {
        setError("Clé incorrecte.")
        setStats(null)
        return
      }
      const data = (await res.json()) as Stats & { error?: string }
      if (data.error) {
        setError(data.error)
        setStats(null)
        return
      }
      setStats(data)
    } catch {
      setError("Réseau indisponible.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY_STORE)
      if (saved) {
        setInput(saved)
        void load(saved)
      }
    } catch {
      // storage indisponible
    }
  }, [load])

  const submit = () => {
    try {
      localStorage.setItem(KEY_STORE, input.trim())
    } catch {
      // storage indisponible
    }
    void load(input.trim())
  }

  return (
    <div className="min-h-dvh overflow-y-auto bg-background px-5 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom,0px)+3rem)]">
      <div className="mx-auto max-w-md">
        <h1 className="text-xl font-black tracking-tight">Statistiques d&apos;usage 🔒</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Réservé au propriétaire — les chiffres d&apos;ouvertures et de visiteurs uniques.
        </p>

        {!stats && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-4">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Clé admin</label>
            <input
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="ADMIN_KEY"
              className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={submit}
              disabled={!input.trim() || loading}
              className="mt-3 w-full rounded-xl bg-primary py-3 text-sm font-extrabold text-primary-foreground active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? "Chargement…" : "Voir mes stats"}
            </button>
            {error && <p className="mt-2 text-xs font-bold text-destructive">{error}</p>}
          </div>
        )}

        {stats && (
          <>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <StatCard label="Ouvertures aujourd'hui" value={stats.today} sub="visites du jour" />
              <StatCard label="Visiteurs aujourd'hui" value={stats.days7.visitors} sub="uniques (7 j)" />
              <StatCard label="Visites 7 jours" value={stats.days7.visits} sub="toutes ouvertures" />
              <StatCard label="Visites totales" value={stats.total} sub="depuis le lancement" />
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-card p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">7 derniers jours</p>
              <div className="mt-3 space-y-1.5">
                {stats.daily.length === 0 && <p className="text-xs text-muted-foreground">Pas encore de visites.</p>}
                {stats.daily.map((d) => (
                  <div key={d.day} className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold tabular-nums text-muted-foreground">{d.day.slice(5)}</span>
                    <div className="flex flex-1 items-center gap-2">
                      <div
                        className="h-2 rounded-full bg-primary/70"
                        style={{ width: `${Math.min(100, (d.visits / Math.max(1, stats.days7.visits)) * 100)}%` }}
                      />
                      <span className="font-bold tabular-nums">
                        {d.visits} visites · {d.visitors} visiteurs
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-3 text-[11px] text-muted-foreground">
              Backend : {stats.backend} · Utilisateurs connectés (7 j) : {stats.days7.users}
            </p>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.removeItem(KEY_STORE)
                } catch {
                  // noop
                }
                setStats(null)
                setInput("")
              }}
              className="mt-4 text-xs font-bold text-muted-foreground underline"
            >
              Verrouiller / changer de clé
            </button>
          </>
        )}

        <a href="/" className="mt-6 block text-center text-xs font-bold text-primary underline">
          ← Retour à l&apos;app
        </a>
      </div>
    </div>
  )
}
