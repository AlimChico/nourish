import { db, usingPostgres } from "@/lib/server/db"

export const dynamic = "force-dynamic"

export async function GET() {
  const ping = await db.ping()
  return Response.json(
    {
      backend: usingPostgres ? "postgres" : "sqlite-fallback",
      connected: ping.ok,
      error: ping.error ?? null,
      // on Vercel the filesystem is read-only: sqlite-fallback there is ephemeral (/tmp)
      persistent: usingPostgres,
      hint:
        usingPostgres
          ? ping.ok
            ? "Supabase connected — accounts are permanent."
            : "DATABASE_URL is set but the connection failed — check the password in the URL."
          : "Set DATABASE_URL (Supabase) on Vercel for a permanent database.",
    },
    { status: ping.ok ? 200 : 503 },
  )
}
