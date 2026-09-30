import { safeEqualStrings, selectAll } from "@/lib/server/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

/**
 * Export de sauvegarde — STRICTEMENT réservé au propriétaire :
 *  - header `x-admin-key: <ADMIN_KEY>`, ou
 *  - session d'un utilisateur dont l'email == ADMIN_EMAIL.
 *
 * Renvoie un dump JSON de toutes les tables (données utilisateurs incluses)
 * SANS les secrets techniques (`users.password`, `sessions.token_hash`) :
 * un fichier de sauvegarde ne doit pas devenir un trousseau de clés.
 * Pour une restauration à l'octet près, utiliser plutôt `pg_dump`
 * (workflow `.github/workflows/db-backup.yml`).
 */
const TABLES = [
  "users",
  "account",
  "day_logs",
  "scans",
  "health",
  "weight",
  "events",
  "community_recipes",
  "recipe_likes",
  "challenge_joins",
  "challenge_progress",
  "premium_codes",
  "push_subscriptions",
  "visits",
] as const

/** Colonnes jamais exportées (secrets d'authentification). */
const SECRET_COLUMNS: Record<string, string[]> = {
  users: ["password"],
  sessions: ["token_hash"],
}

async function isAdmin(request: Request): Promise<boolean> {
  const adminKey = process.env.ADMIN_KEY
  const provided = request.headers.get("x-admin-key") ?? ""
  if (adminKey && provided && safeEqualStrings(provided, adminKey)) return true

  const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase()
  if (!adminEmail) return false
  try {
    const { getSessionUserFromToken, SESSION_COOKIE } = await import("@/lib/server/db")
    const cookie = request.headers.get("cookie") ?? ""
    const token = cookie
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
      ?.slice(SESSION_COOKIE.length + 1)
    const user = await getSessionUserFromToken(token)
    return !!user && user.email.toLowerCase() === adminEmail
  } catch {
    return false
  }
}

export async function GET(request: Request) {
  if (!(await isAdmin(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const data: Record<string, Record<string, unknown>[]> = {}
    const counts: Record<string, number> = {}
    for (const table of TABLES) {
      const rows = await selectAll(table)
      const secrets = SECRET_COLUMNS[table] ?? []
      data[table] =
        secrets.length === 0
          ? rows
          : rows.map((r) => {
              const copy = { ...r }
              for (const s of secrets) delete copy[s]
              return copy
            })
      counts[table] = data[table].length
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-")
    return new Response(JSON.stringify({ generatedAt: new Date().toISOString(), tables: counts, data }, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="sahtek-backup-${stamp}.json"`,
        "cache-control": "no-store",
      },
    })
  } catch (err) {
    console.error("backup failed:", err instanceof Error ? err.message : err)
    return Response.json({ error: "Backup failed" }, { status: 500 })
  }
}
