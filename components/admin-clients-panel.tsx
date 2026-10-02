"use client"

import { useCallback, useEffect, useState } from "react"

type ClientRow = {
  id: string
  email: string
  name: string
  created_at: number
}

type ClientsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; clients: ClientRow[] }
  | { status: "error"; error: string }

export function AdminClientsPanel() {
  const [clients, setClients] = useState<ClientRow[]>([])
  const [state, setState] = useState<ClientsState>({ status: "idle" })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"overview" | "sessions" | "deletion">("overview")
  // Clé admin : état local (jamais localStorage pendant le rendu — le composant
  // est rendu côté serveur au premier passage).
  const [keyInput, setKeyInput] = useState("")

  const load = useCallback(async (adminKey?: string) => {
    setLoading(true)
    setError(null)
    try {
      const headers: Record<string, string> = {}
      if (adminKey) headers["x-admin-key"] = adminKey
      const res = await fetch("/api/admin/clients", { headers })
      if (res.status === 401) {
        setError("Clé admin invalide.")
        setState({ status: "idle" })
        setClients([])
        return
      }
      const data = (await res.json()) as {
        ok?: boolean
        error?: string
        clients?: ClientRow[]
      }
      if (data.error) {
        setError(data.error)
        setState({ status: "idle" })
        setClients([])
        return
      }
      setClients(data.clients ?? [])
      setState({ status: "success", clients: data.clients ?? [] })
    } catch {
      setError("Réseau indisponible.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("sahtek.adminkey.v1") : null
    if (saved) {
      setKeyInput(saved)
      void load(saved)
    }
  }, [load])

  const deleteClient = useCallback(
    async (id: string, email: string) => {
      if (!confirm(`Supprimer le compte ${email} ? Cette action est définitive.`)) return
      setLoading(true)
      setError(null)
      try {
        const res = await fetch("/api/admin/clients", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userId: id, email }),
        })
        const data = (await res.json()) as { ok?: boolean; error?: string }
        if (data.error) {
          setError(data.error)
        } else {
          setClients((prev) => prev.filter((c) => c.id !== id))
          setState({ status: "success", clients: [...clients.filter((c) => c.id !== id)] })
        }
      } catch {
        setError("Réseau indisponible.")
      } finally {
        setLoading(false)
      }
    },
    [clients],
  )

  const downloadJson = useCallback(() => {
    const blob = new Blob([JSON.stringify({ generatedAt: new Date().toISOString(), clients }, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `nourish-clients-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  const downloadCsv = useCallback(() => {
    const header = ["id", "email", "name", "created_at"]
    const rows = clients.map((c) => [c.id, c.email, c.name, String(c.created_at)])
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `nourish-clients-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [clients])

  return (
    <div className="w-full max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight">Administration des clients</h1>
          <p className="text-xs text-muted-foreground">
            Liste de tous les comptes inscrits — nom, email, date d'inscription.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={downloadJson}
            disabled={loading || clients.length === 0}
            className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent disabled:opacity-50"
          >
            Télécharger JSON
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            disabled={loading || clients.length === 0}
            className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent disabled:opacity-50"
          >
            Télécharger CSV
          </button>
        </div>
      </div>

      {error && <p className="text-xs font-bold text-destructive">{error}</p>}

      {state.status === "idle" && !error && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Clé admin
          </label>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => {
              const v = e.target.value
              setKeyInput(v)
              localStorage.setItem("sahtek.adminkey.v1", v)
            }}
            onKeyDown={(e) => e.key === "Enter" && void load(keyInput)}
            placeholder="ADMIN_KEY"
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-semibold outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={() => void load(keyInput)}
            disabled={!keyInput || loading}
            className="mt-3 w-full rounded-xl bg-primary py-3 text-sm font-extrabold text-primary-foreground active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? "Chargement…" : "Charger la liste des clients"}
          </button>
        </div>
      )}

      {state.status === "success" && clients.length === 0 && (
        <p className="text-xs text-muted-foreground">Aucun client pour le moment.</p>
      )}

      {state.status === "success" && clients.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {clients.length} client{clients.length > 1 ? "s" : ""} inscrit{clients.length > 1 ? "s" : ""}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={downloadJson}
                disabled={loading}
                className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent disabled:opacity-50"
              >
                Télécharger JSON
              </button>
              <button
                type="button"
                onClick={downloadCsv}
                disabled={loading}
                className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-accent disabled:opacity-50"
              >
                Télécharger CSV
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {clients.map((c) => (
              <div
                key={c.id}
                className={`rounded-xl border p-4 ${
                  selectedId === c.id ? "border-primary bg-primary/5" : "border-border bg-card"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold">{c.name || "(pas de nom)"}</p>
                    <p className="text-xs font-mono text-muted-foreground">{c.email}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Inscrit le {new Date(c.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label="Afficher/masquer les détails"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {selectedId === c.id ? (
                        <>
                          <path d="M3 7.5 5.5 10 13 4" />
                          <path d="M8 10.5 5.5 12 13 4" />
                        </>
                      ) : (
                        <>
                          <path d="M8 3v10" />
                          <path d="M5 6l3 3 3-3" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>

                {selectedId === c.id && (
                  <div className="mt-3 border-t border-border/60 pt-3 space-y-2 animate-in fade-in slide-in-from-top-1">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-muted/40 p-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">ID</p>
                        <p className="mt-0.5 font-mono text-[11px]">{c.id}</p>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email</p>
                        <p className="mt-0.5 text-sm font-medium">{c.email}</p>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nom</p>
                        <p className="mt-0.5 text-sm">{c.name || "—"}</p>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Inscrit le</p>
                        <p className="mt-0.5 text-sm">
                          {new Date(c.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab("overview")}
                        className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-accent"
                      >
                        Vue d'ensemble
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("sessions")}
                        className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-accent"
                      >
                        Sessions actives
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("deletion")}
                        className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-accent"
                      >
                        Supprimer le compte
                      </button>
                    </div>

                    {activeTab === "overview" && (
                      <div className="mt-2 text-xs text-muted-foreground space-y-1">
                        <p>Vue d'ensemble : activez le menu admin pour voir les statistiques globales.</p>
                      </div>
                    )}
                    {activeTab === "sessions" && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        <p>Gestion des sessions actives : cette fonctionnalité est en cours de développement.</p>
                      </div>
                    )}
                    {activeTab === "deletion" && (
                      <div className="mt-2 space-y-2">
                        <p className="text-xs font-bold text-destructive">
                          ⚠️ Suppression définitive
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Cette action supprime définitivement toutes les données du client (journaux,
                          poids, inscriptions,sessions). Cette action est irréversible.
                        </p>
                        <button
                          type="button"
                          onClick={() => deleteClient(c.id, c.email)}
                          disabled={loading}
                          className="rounded-xl bg-destructive/10 px-4 py-2 text-xs font-bold text-destructive hover:bg-destructive/20 disabled:opacity-50"
                        >
                          Supprimer définitivement
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {state.status === "error" && (
        <p className="text-xs font-bold text-destructive">{error || "Échec du chargement."}</p>
      )}
    </div>
  )
}
