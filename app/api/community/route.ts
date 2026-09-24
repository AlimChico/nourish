import { db, getSessionUserFromToken, rateLimit, SESSION_COOKIE } from "@/lib/server/db"

export const dynamic = "force-dynamic"

const TITLE_MAX = 80
const DESC_MAX = 400

function parseCookie(cookie: string, name: string): string | undefined {
  const m = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`).exec(cookie)
  return m ? decodeURIComponent(m[1]) : undefined
}

async function authed(request: Request) {
  return getSessionUserFromToken(parseCookie(request.headers.get("cookie") ?? "", SESSION_COOKIE))
}

const clampInt = (v: unknown, min: number, max: number) => {
  const n = Math.round(Number(v))
  return isFinite(n) ? Math.min(max, Math.max(min, n)) : min
}

/** GET /api/community — recipes + leaderboard + my progress in one call. */
export async function GET(request: Request) {
  const user = await authed(request)
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(request.url)
  const challenge = url.searchParams.get("challenge") || "ramadan-2026"

  const [recipes, leaderboard, progress, joins, likes] = await Promise.all([
    db.listRecipes(60),
    db.challengeLeaderboard(challenge),
    db.challengeProgressFor(user.id),
    db.challengeJoinsFor(user.id),
    db.likesSummaryFor(user.id),
  ])

  return Response.json({
    recipes: recipes.map((r) => ({ ...r, likes: likes[r.id]?.total ?? 0, likedByMe: likes[r.id]?.liked ?? false })),
    challenge,
    leaderboard,
    myProgress: progress,
    myJoins: joins,
  })
}

/** POST /api/community — share a recipe, join a challenge, or add points. */
export async function POST(request: Request) {
  const user = await authed(request)
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const body = ((await request.json().catch(() => null)) as Record<string, unknown> | null) ?? {}
  const kind = typeof body?.kind === "string" ? body.kind : ""

  if (kind === "recipe") {
    const limit = rateLimit(`recipe:${user.id}`, 10, 60 * 60 * 1000)
    if (!limit.ok) return Response.json({ error: "Trop de recettes partagées — réessaie plus tard." }, { status: 429 })

    const title = typeof body.title === "string" ? body.title.trim().slice(0, TITLE_MAX) : ""
    const description = typeof body.description === "string" ? body.description.trim().slice(0, DESC_MAX) : ""
    const emoji = typeof body.emoji === "string" && /^[\p{Emoji_Presentation}\p{Extended_Pictographic}]$/u.test(body.emoji) ? body.emoji : "🥗"
    if (title.length < 3) return Response.json({ error: "Titre trop court" }, { status: 400 })
    if (description.length < 10) return Response.json({ error: "Décris ta recette en quelques mots de plus" }, { status: 400 })

    const recipe = {
      id: `rcp_${crypto.randomUUID().slice(0, 18)}`,
      userId: user.id,
      authorName: user.name,
      title,
      description,
      calories: clampInt(body.calories, 0, 5000),
      protein: clampInt(body.protein, 0, 400),
      carbs: clampInt(body.carbs, 0, 800),
      fat: clampInt(body.fat, 0, 400),
      emoji,
    }
    await db.insertRecipe(recipe)
    return Response.json({ ok: true, recipe })
  }

  if (kind === "join") {
    const limit = rateLimit(`join:${user.id}`, 20, 60 * 60 * 1000)
    if (!limit.ok) return Response.json({ error: "Too many requests" }, { status: 429 })
    const key = typeof body.challenge === "string" ? body.challenge.slice(0, 60) : ""
    if (!key) return Response.json({ error: "Invalid challenge" }, { status: 400 })
    await db.joinChallenge(user.id, key)
    return Response.json({ ok: true })
  }

  if (kind === "points") {
    const limit = rateLimit(`points:${user.id}`, 30, 60 * 1000)
    if (!limit.ok) return Response.json({ error: "Too many requests" }, { status: 429 })
    const key = typeof body.challenge === "string" ? body.challenge.slice(0, 60) : ""
    const points = clampInt(body.points, 1, 10)
    if (!key) return Response.json({ error: "Invalid challenge" }, { status: 400 })
    await db.addChallengePoints(user.id, key, points)
    const leaderboard = await db.challengeLeaderboard(key)
    return Response.json({ ok: true, leaderboard })
  }

  if (kind === "like") {
    const limit = rateLimit(`like:${user.id}`, 40, 60 * 1000)
    if (!limit.ok) return Response.json({ error: "Too many requests" }, { status: 429 })
    const id = typeof body.id === "string" ? body.id.slice(0, 64) : ""
    if (!id) return Response.json({ error: "Invalid id" }, { status: 400 })
    try {
      const r = await db.toggleRecipeLike(id, user.id)
      return Response.json({ ok: true, ...r })
    } catch {
      // FK violation: recipe doesn't exist (deleted concurrently)
      return Response.json({ error: "Recette introuvable" }, { status: 404 })
    }
  }

  if (kind === "delete-recipe") {
    const id = typeof body.id === "string" ? body.id.slice(0, 64) : ""
    if (!id) return Response.json({ error: "Invalid id" }, { status: 400 })
    const ok = await db.deleteRecipeIfOwner(id, user.id)
    return Response.json({ ok }, { status: ok ? 200 : 403 })
  }

  return Response.json({ error: "Unknown kind" }, { status: 400 })
}
