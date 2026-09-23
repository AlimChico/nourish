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

  // Who am I? (page load)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await api<{ user: AuthUser | null }>("/api/auth/me")
      if (cancelled) return
      if (data?.user) {
        setUser(data.user)
        setStatus("authed")
      } else {
        setStatus("anon")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

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
    setUser(r.data.user)
    setStatus("authed")
    return { ok: true }
  }, [])

  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" })
    setUser(null)
    setStatus("anon")
    setRestoredAccount(null)
    setSyncError(null)
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

export function pushSnapshot(kind: "account" | "day" | "health", payload: unknown): void {
  const body = kind === "account" ? { account: payload } : kind === "day" ? { day: payload } : { health: payload }
  void api(`/api/sync/${kind}`, { method: "PUT", body: JSON.stringify(body) }).then((r) => {
    if (!r.ok && r.status !== 401) pushErrorListener?.("Sync failed — data kept locally")
  })
}

/** Debounced mirror of one store to the server while authed. */
export function useCloudPush<T>(kind: "account" | "day" | "health", payload: T, opts: { authed: boolean; enabled?: boolean }) {
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
