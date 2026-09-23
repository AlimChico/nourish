import { rateLimit, clientIp } from "@/lib/server/db"

export const dynamic = "force-dynamic"

/**
 * One-time local setup helper:
 * POST { databaseUrl } → validates the connection against Supabase and, when
 * running locally (writable FS), stores it in .env.local. Never returns or logs
 * the secret. On Vercel this returns instructions instead (no FS writes).
 */
export async function POST(request: Request) {
  const limit = rateLimit(`dbsetup:${clientIp(request)}`, 5, 60 * 60 * 1000)
  if (!limit.ok) return Response.json({ error: "Too many attempts" }, { status: 429 })

  const body = (await request.json().catch(() => null)) as { databaseUrl?: string } | null
  const url = typeof body?.databaseUrl === "string" ? body.databaseUrl.trim() : ""
  if (!/^postgres(ql)?:\/\//.test(url)) {
    return Response.json({ error: "URL must start with postgresql://" }, { status: 400 })
  }

  // Validate the connection without touching the app's active backend.
  try {
    const { default: postgres } = await import("postgres")
    const probe = postgres(url, { prepare: false, max: 1, connect_timeout: 10, idle_timeout: 5 })
    try {
      await probe`SELECT 1`
    } finally {
      await probe.end({ timeout: 5 })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const friendly = /password/i.test(msg)
      ? "Wrong password for this Supabase project."
      : /ENOTFOUND|tenant/i.test(msg)
        ? "Host/region not found — check the pooler URL."
        : "Connection failed: " + msg.slice(0, 140)
    return Response.json({ ok: false, error: friendly }, { status: 400 })
  }

  // Connected! Persist for local dev (Vercel uses its own env vars).
  const readOnly = !canWrite(process.cwd())
  if (readOnly) {
    return Response.json({
      ok: true,
      stored: false,
      message:
        "Connection valid. This is a read-only host — add DATABASE_URL in Vercel → Settings → Environment Variables, then Redeploy.",
    })
  }

  try {
    const envPath = require("node:path").join(process.cwd(), ".env.local")
    let content = ""
    try {
      content = require("node:fs").readFileSync(envPath, "utf8")
    } catch {
      // first write
    }
    const cleaned = content
      .split("\n")
      .filter((l: string) => !/^DATABASE_URL=/m.test(l) && !/^# DATABASE_URL=/m.test(l))
      .join("\n")
    require("node:fs").writeFileSync(envPath, cleaned + `\nDATABASE_URL=${url}\n`)
    return Response.json({ ok: true, stored: true, message: "DATABASE_URL saved to .env.local — restart the dev server." })
  } catch {
    return Response.json({ ok: true, stored: false, message: "Connection valid but could not write .env.local — add it manually." })
  }
}

function canWrite(dir: string): boolean {
  try {
    require("node:fs").accessSync(dir, require("node:fs").constants.W_OK)
    return true
  } catch {
    return false
  }
}
