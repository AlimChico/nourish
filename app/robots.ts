import type { MetadataRoute } from "next"

/**
 * robots.txt — indexation des moteurs de recherche :
 *  - tout le site public est crawlable (/, /privacy, /share…),
 *  - les pages outils/privées sont exclues (API, diagnostic, stats propriétaire),
 *  - le sitemap est annoncé pour accélérer la découverte.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/diag", "/stats"],
      },
    ],
    sitemap: "https://nourish-roan.vercel.app/sitemap.xml",
  }
}
