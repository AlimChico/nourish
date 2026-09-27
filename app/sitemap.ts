import type { MetadataRoute } from "next"

/**
 * sitemap.xml — les pages publiques réellement indexables.
 * L'app (/, /privacy) est statique ; /share est dynamique mais son point
 * d'entrée mérite l'indexation (liens partagés).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://nourish-roan.vercel.app"
  return [
    { url: base, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/privacy`, lastModified: new Date("2026-09-24"), changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/share`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
  ]
}
