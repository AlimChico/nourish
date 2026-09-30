"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"

/**
 * Client sync layer — talks to the SQLite-backed API.
 *
 * The app stays offline-first: localStorage remains the immediate source of
 * truth for the UI. When a session exists, a bridge component mirrors the
 * stores to the server (debounced) and pulls cloud data back after login.
 */

export type AuthUser = { id: string; email: string; name: string }
type Status = "loading" | "anon" | "authed"

type SyncStore = {
  user: AuthUser | null
  status: Status
  syncError: string | null
  /** Account payload pulled from the server after login, consumed once by the bridge. */
  restoredAccount: unknown | null
  consumeRestoredAccount: () => void
  signup: (name: string, email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => Promise<void>
}

const SyncContext = createContext<SyncStore | null>(null)

export async function api<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  try {
    const res = await fetch(path, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    })
    const data = (await res.json().catch(() => null)) as T | null
    const error = (data as { error?: string } | null)?.error
    return { ok: res.ok, status: res.status, data, error }
  } catch {
    return { ok: false, status: 0, data: null, error: "network" }
  }
}

// ---------------------------------------------------------------------------
// Dernière identité connue — la session doit survivre à une coupure réseau.
// ---------------------------------------------------------------------------

const SESSION_HINT_KEY = "sahtek.session-hint.v1"

/**
 * `GET /api/auth/me` échoue hors ligne (statut HTTP 0) — ce n'est PAS la même
 * chose qu'une absence de session (401). Sans cette distinction, ouvrir l'APK
 * sans réseau faisait passer l'utilisateur pour déconnecté : l'historique
 * serveur et le classement disparaissaient, et surtout `useCloudPush` refusait
 * de pousser quoi que ce soit. Les repas loggés pendant la coupure
 * n'atteignaient alors JAMAIS le serveur, même après le retour du réseau.
 *
 * Cet indice n'est qu'un état d'affichage : il ne donne aucun droit. Chaque
 * appel API reste autorisé (ou refusé) par le serveur via le cookie de session.
 */
function readSessionHint(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_HINT_KEY)
    if (!raw) return null
    const u = JSON.parse(raw) as AuthUser
    return u && typeof u.id === "string" && typeof u.email === "string" ? u : null
  } catch {
    return null
  }
}

function writeSessionHint(user: AuthUser | null): void {
  try {
    if (user) localStorage.setItem(SESSION_HINT_KEY, JSON.stringify(user))
    else localStorage.removeItem(SESSION_HINT_KEY)
  } catch {
    // stockage indisponible
  }
}

// Push failures are surfaced through the provider via a module-level listener.
let pushErrorListener: ((msg: string | null) => void) | null = null

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<Status>("loading")
  const [syncError, setSyncError] = useState<string | null>(null)
  const [restoredAccount, setRestoredAccount] = useState<unknown | null>(null)

  // Mirror push failures into state.
  useEffect(() => {
    pushErrorListener = setSyncError
    return () => {
      pushErrorListener = null
    }
  }, [])

  /**
   * Interroge la session. Seule une réponse FERME du serveur fait basculer
   * l'app en « non connecté » : un échec réseau (statut 0) laisse l'état en
   * place, car il ne prouve rien sur la validité de la session.
   */
  const checkAuth = useCallback(async () => {
    const { data, status: httpStatus } = await api<{ user: AuthUser | null }>("/api/auth/me")
    if (data?.user) {
      writeSessionHint(data.user)
      setUser(data.user)
      setStatus("authed")
      return
    }
    if (httpStatus === 0) return
    // 200 sans utilisateur ou 401 : le serveur a répondu, la session est close.
    writeSessionHint(null)
    setUser(null)
    setStatus("anon")
  }, [])

  // Who am I? (page load)
  useEffect(() => {
    // L'identité mémorisée s'affiche immédiatement : sans elle, l'app se
    // présentait comme déconnectée le temps de la requête, et pour toute la
    // session en cas de coupure réseau.
    const hinted = readSessionHint()
    if (hinted) {
      setUser(hinted)
      setStatus("authed")
    }
    void checkAuth()
  }, [checkAuth])

  // Retour du réseau / retour de l'app au premier plan : on revérifie la
  // session, sinon un démarrage hors ligne laissait l'app « déconnectée »
  // jusqu'au prochain rechargement complet.
  useEffect(() => {
    const recheck = () => {
      if (document.visibilityState === "visible") void checkAuth()
    }
    window.addEventListener("online", recheck)
    document.addEventListener("visibilitychange", recheck)
    return () => {
      window.removeEventListener("online", recheck)
      document.removeEventListener("visibilitychange", recheck)
    }
  }, [checkAuth])

  // Pull the cloud account when a session appears (login/signup on this browser).
  useEffect(() => {
    if (status !== "authed") return
    let cancelled = false
    ;(async () => {
      const { data } = await api<{ account: unknown }>("/api/sync/account")
      if (!cancelled && data?.account) setRestoredAccount(data.account)
    })()
    return () => {
      cancelled = true
    }
  }, [status, user?.id])

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const r = await api<{ user: AuthUser }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    })
    if (!r.ok || !r.data?.user) return { ok: false, error: r.error ?? "Signup failed" }
    writeSessionHint(r.data.user)
    setUser(r.data.user)
    setStatus("authed")
    return { ok: true }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const r = await api<{ user: AuthUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })
    if (!r.ok || !r.data?.user) return { ok: false, error: r.error ?? "Login failed" }
    writeSessionHint(r.data.user)
    setUser(r.data.user)
    setStatus("authed")
    return { ok: true }
  }, [])

  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" })
    writeSessionHint(null)
    setUser(null)
    setStatus("anon")
    setRestoredAccount(null)
    setSyncError(null)
    pendingFailure = false
    lastPayloads.account = undefined
    lastPayloads.day = undefined
    lastPayloads.health = undefined
    lastPayloads.weight = undefined
  }, [])

  const consumeRestoredAccount = useCallback(() => setRestoredAccount(null), [])

  const store = useMemo<SyncStore>(
    () => ({ user, status, syncError, restoredAccount, consumeRestoredAccount, signup, login, logout }),
    [user, status, syncError, restoredAccount, consumeRestoredAccount, signup, login, logout],
  )

  return <SyncContext.Provider value={store}>{children}</SyncContext.Provider>
}

export function useSync(): SyncStore {
  const ctx = useContext(SyncContext)
  if (!ctx) throw new Error("useSync must be used inside <SyncProvider>")
  return ctx
}

// ---------------------------------------------------------------------------
// Push — debounced PUT of one store snapshot. Safe no-op when logged out.
// ---------------------------------------------------------------------------

export type SyncKind = "account" | "day" | "health" | "weight"

function bodyFor(kind: SyncKind, payload: unknown): string {
  switch (kind) {
    case "account":
      return JSON.stringify({ account: payload })
    case "day":
      return JSON.stringify({ day: payload })
    case "health":
      return JSON.stringify({ health: payload })
    case "weight":
      return JSON.stringify({ weight: payload })
  }
}

export function pushSnapshot(kind: SyncKind, payload: unknown): void {
  // Dernier état connu de chaque store : permet de TOUT re-pousser d'un coup
  // après une coupure réseau (bouton « Réessayer » du bandeau de synchro).
  lastPayloads[kind] = payload
  const body = bodyFor(kind, payload)
  void api(`/api/sync/${kind}`, { method: "PUT", body: JSON.stringify(body) }).then((r) => {
    if (!r.ok && r.status !== 401) {
      pendingFailure = true
      pushErrorListener?.("sync_failed")
    } else if (r.ok) {
      pendingFailure = false
      pushErrorListener?.(null)
    }
  })
}

const lastPayloads: Partial<Record<SyncKind, unknown>> = {}
let pendingFailure = false

/** Le nuage n'a pas la dernière version locale (hors-ligne, serveur en erreur…). */
export function hasPendingSync(): boolean {
  return pendingFailure
}

/** Re-pousse tous les stores connus — utilisé par le bouton « Réessayer ». */
export function retryAllPushes(): void {
  const kinds: SyncKind[] = ["account", "day", "health", "weight"]
  for (const kind of kinds) {
    const payload = lastPayloads[kind]
    if (payload !== undefined) pushSnapshot(kind, payload)
  }
}

/** Debounced mirror of one store to the server while authed. */
export function useCloudPush<T>(kind: SyncKind, payload: T, opts: { authed: boolean; enabled?: boolean }) {
  const { authed, enabled = true } = opts
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(payload)
  latest.current = payload

  useEffect(() => {
    if (!authed || !enabled) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => pushSnapshot(kind, latest.current), 1200)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [authed, enabled, kind, payload])
}
