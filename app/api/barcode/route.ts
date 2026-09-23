import { rateLimit, clientIp } from "@/lib/server/db"

export const maxDuration = 30

export type OFFProduct = {
  code: string
  name: string
  brand: string | null
  image: string | null
  serving: string
  per100g: { calories: number | null; protein: number | null; carbs: number | null; fat: number | null } | null
  perServing: { calories: number | null; protein: number | null; carbs: number | null; fat: number | null } | null
  nutriscore: string | null
}

const num = (v: unknown): number | null =>
  typeof v === "number" && isFinite(v) && v >= 0 ? Math.round(v * 10) / 10 : null

export async function GET(request: Request) {
  const limit = rateLimit(`off:${clientIp(request)}`, 30, 60 * 1000)
  if (!limit.ok) return Response.json({ error: "Too many requests" }, { status: 429 })

  const code = new URL(request.url).searchParams.get("code") ?? ""
  // EAN-8 / EAN-13 / UPC-A
  if (!/^\d{8}$|^\d{12,13}$/.test(code)) {
    return Response.json({ error: "Invalid barcode" }, { status: 400 })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12_000)
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_fr,brands,image_small_url,serving_size,nutriments,nutrition_grades`,
      { signal: controller.signal, headers: { "User-Agent": "Sahtek - Tunisia - https://sahtek.app" } },
    )
    clearTimeout(timeout)

    if (res.status === 404) return Response.json({ error: "Product not found" }, { status: 404 })
    if (!res.ok) return Response.json({ error: "Open Food Facts unavailable" }, { status: 502 })

    const data = (await res.json()) as { status?: number; product?: Record<string, unknown> }
    if (data.status !== 1 || !data.product) {
      return Response.json({ error: "Product not found" }, { status: 404 })
    }

    const p = data.product
    const n = (p.nutriments ?? {}) as Record<string, unknown>

    const per100: OFFProduct["per100g"] = {
      calories: num(n["energy-kcal_100g"]) ?? (num(n["energy_100g"]) ? Math.round((num(n["energy_100g"]) as number) / 4.184) : null),
      protein: num(n["proteins_100g"]),
      carbs: num(n["carbohydrates_100g"]),
      fat: num(n["fat_100g"]),
    }
    const perServ: OFFProduct["perServing"] = {
      calories: num(n["energy-kcal_serving"]),
      protein: num(n["proteins_serving"]),
      carbs: num(n["carbohydrates_serving"]),
      fat: num(n["fat_serving"]),
    }
    const has100 = per100.calories !== null || per100.protein !== null
    const hasServ = perServ.calories !== null || perServ.protein !== null

    const product: OFFProduct = {
      code,
      name: (typeof p.product_name_fr === "string" && p.product_name_fr) || (typeof p.product_name === "string" ? p.product_name : "") || "Produit inconnu",
      brand: typeof p.brands === "string" ? p.brands.split(",")[0]?.trim() ?? null : null,
      image: typeof p.image_small_url === "string" ? p.image_small_url : null,
      serving: typeof p.serving_size === "string" && p.serving_size ? p.serving_size : "100 g",
      per100g: has100 ? per100 : null,
      perServing: hasServ ? perServ : null,
      nutriscore: typeof p.nutrition_grades === "string" && /^[a-e]$/.test(p.nutrition_grades) ? p.nutrition_grades.toUpperCase() : null,
    }

    if (!product.per100g && !product.perServing) {
      return Response.json({ error: "No nutrition data for this product" }, { status: 404 })
    }

    return Response.json({ product }, { headers: { "Cache-Control": "public, max-age=86400" } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("barcode lookup failed:", msg)
    return Response.json({ error: msg.includes("abort") ? "Lookup timed out" : "Lookup failed" }, { status: 502 })
  }
}
