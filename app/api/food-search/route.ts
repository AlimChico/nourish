import { rateLimit, clientIp } from "@/lib/server/db"

export const maxDuration = 20

export async function GET(request: Request) {
  const limit = rateLimit(`foodsearch:${clientIp(request)}`, 30, 60 * 1000)
  if (!limit.ok) return Response.json({ error: "Too many requests" }, { status: 429 })

  const name = new URL(request.url).searchParams.get("name")?.trim() ?? ""
  if (name.length < 3 || name.length > 80) {
    return Response.json({ foods: [] })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    const url =
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(name)}` +
      `&search_simple=1&action=process&json=1&page_size=12` +
      `&fields=code,product_name,product_name_fr,brands,image_small_url,serving_size,nutriments`
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Sahtek - Tunisia - https://sahtek.app" },
    })
    clearTimeout(timeout)
    if (!res.ok) return Response.json({ foods: [] })

    const data = (await res.json()) as { products?: Record<string, unknown>[] }
    const foods = (data.products ?? [])
      .filter((p) => typeof p.product_name === "string" && p.product_name.trim())
      .map((p) => {
        const n = (p.nutriments ?? {}) as Record<string, unknown>
        const kcal = typeof n["energy-kcal_100g"] === "number" ? Math.round(n["energy-kcal_100g"] as number) : null
        const g = (k: string) => (typeof n[k] === "number" ? Math.round((n[k] as number) * 10) / 10 : 0)
        return {
          id: `off_${String(p.code ?? Math.random().toString(36).slice(2))}`,
          name: ((p.product_name_fr as string) || (p.product_name as string) || "").trim().slice(0, 80),
          brand: typeof p.brands === "string" ? p.brands.split(",")[0]?.trim() : undefined,
          serving: typeof p.serving_size === "string" && p.serving_size ? p.serving_size : "100 g",
          calories: kcal ?? 0,
          protein: g("proteins_100g"),
          carbs: g("carbohydrates_100g"),
          fat: g("fat_100g"),
          emoji: "🌍",
        }
      })
      .filter((f) => f.calories > 0 || f.protein > 0 || f.carbs > 0 || f.fat > 0)
      .slice(0, 10)

    return Response.json({ foods }, { headers: { "Cache-Control": "public, max-age=3600" } })
  } catch (err) {
    console.error("food-search failed:", err instanceof Error ? err.message : err)
    return Response.json({ foods: [] })
  }
}
