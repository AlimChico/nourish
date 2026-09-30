import { db, getSessionUserFromToken, rateLimit, SESSION_COOKIE } from "@/lib/server/db"
import { computeXp, dayActivityFromData, type XpDay } from "@/lib/xp"
import { todayKey } from "@/lib/date-key"
import { initialsOf } from "@/lib/account-schema"

export const dynamic = "force-dynamic"

/**
 * Classement XP — agrégé CÔTÉ SERVEUR à partir des journées réellement
 * journalisées (`day_logs`), avec le même moteur que le client (`lib/xp.ts`).
 *
 * Ce qui n'est JAMAIS exposé : e-mail, identifiant de compte, données de repas.
 * Seuls le nom d'affichage (obligatoire à l'inscription), les initiales, le
 * niveau, la série et l'XP sortent — un utilisateur ne peut donc pas voir ce
 * qu'un autre a mangé.
 */

type ScoredRow = {
  id: string
  rank: number
  name: string
  initials: string
  xp: number
  level: number
  title: string
  streak: number
}

type PublicRow = Omit<ScoredRow, "id"> & { isMe: boolean }

const TOP = 50
/** Le classement bouge lentement : un recalcul par minute suffit (et un seul
 *  par instance), ce qui met les appels en cache pour tous les visiteurs. */
const CACHE_MS = 60_000

let cache: { at: number; rows: ScoredRow[] } | null = null

function cleanName(name: string): string {
  const trimmed = name.replace(/\s+/g, " ").trim().slice(0, 40)
  return trimmed.length >= 2 ? trimmed : "Sahtek user"
}

function parseCookie(cookie: string, name: string): string | undefined {
  const m = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`).exec(cookie)
  return m ? decodeURIComponent(m[1]) : undefined
}

async function buildBoard(): Promise<{ at: number; rows: ScoredRow[] }> {
  const now = Date.now()
  if (cache && now - cache.at < CACHE_MS) return cache

  const raw = await db.xpRowsForAllUsers()
  const byUser = new Map<string, { name: string; days: XpDay[] }>()
  for (const r of raw) {
    let u = byUser.get(r.id)
    if (!u) {
      u = { name: cleanName(r.name), days: [] }
      byUser.set(r.id, u)
    }
    // Journée vide (ligne créée par une synchro sans repas) : ignorée, sinon
    // elle gonflerait à la fois l'XP et la série.
    const activity = dayActivityFromData(r.data)
    if (activity.entries === 0 && activity.water === 0) continue
    u.days.push({ date: r.date, entries: activity.entries })
  }

  const today = todayKey()
  const scored: { id: string; name: string; xp: number; level: number; title: string; streak: number }[] = []
  for (const [id, u] of byUser) {
    const summary = computeXp(u.days, today)
    if (summary.totalXp <= 0) continue
    scored.push({
      id,
      name: u.name,
      xp: summary.totalXp,
      level: summary.level.level,
      title: summary.level.title,
      streak: summary.streak,
    })
  }
  // Départage : XP, puis série en cours, puis ordre alphabétique (stable).
  scored.sort((a, b) => b.xp - a.xp || b.streak - a.streak || a.name.localeCompare(b.name))

  const rows: ScoredRow[] = scored.map((s, i) => ({
    id: s.id,
    rank: i + 1,
    name: s.name,
    initials: initialsOf(s.name),
    xp: s.xp,
    level: s.level,
    title: s.title,
    streak: s.streak,
  }))

  cache = { at: now, rows }
  return cache
}

export async function GET(request: Request) {
  const user = await getSessionUserFromToken(parseCookie(request.headers.get("cookie") ?? "", SESSION_COOKIE))
  if (!user) return Response.json({ error: "Sign in to see the leaderboard." }, { status: 401 })

  const limit = rateLimit(`leaderboard:${user.id}`, 30, 60_000)
  if (!limit.ok) return Response.json({ error: "Too many requests" }, { status: 429 })

  const board = await buildBoard()
  const mine = board.rows.find((r) => r.id === user.id) ?? null

  const strip = (r: ScoredRow): PublicRow => ({
    rank: r.rank,
    name: r.name,
    initials: r.initials,
    xp: r.xp,
    level: r.level,
    title: r.title,
    streak: r.streak,
    isMe: r.id === user.id,
  })

  const entries = board.rows.slice(0, TOP).map(strip)
  // Hors du top : on rattache l'utilisateur en fin de liste pour qu'il voie sa
  // place sans avoir à faire défiler tout le classement.
  if (mine && mine.rank > TOP) entries.push(strip(mine))

  return Response.json(
    {
      updatedAt: board.at,
      total: board.rows.length,
      me: mine ? strip(mine) : null,
      entries,
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
