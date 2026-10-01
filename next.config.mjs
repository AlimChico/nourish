/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      // ─── Headers de sécurité globaux (appliqués à toutes les routes) ───
      {
        source: "/(.*) [\.]apk$",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          { key: "Content-Disposition", value: 'attachment; filename="sahtek-android.apk"' },
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
      // Clickjacking
      { source: "/(.*)", headers: [{ key: "X-Frame-Options", value: "DENY" }] },
      // MIME sniffing
      { source: "/(.*)", headers: [{ key: "X-Content-Type-Options", value: "nosniff" }] },
      // Cache: pas de cache pour les pages dynamiques
      {
        source: "/(.*)",
        headers: [{ key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" }],
      },
      // Referrer Policy
      { source: "/(.*)", headers: [{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }] },
      // Permissions Policy
      {
        source: "/(.*)",
        headers: [{ key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" }],
      },
      // CSP
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; " +
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
              "style-src 'self' 'unsafe-inline'; " +
              "img-src 'self' data: https:; " +
              "font-src 'self' data:; " +
              "connect-src 'self' https://*.supabase.co https://oauth2.googleapis.com https://appleid.apple.com https://openidconnect.googleapis.com https://*.pooler.supabase.com; " +
              "frame-ancestors 'none'; " +
              "base-uri 'self'; " +
              "form-action 'self' https://accounts.google.com https://appleid.apple.com;",
          },
        ],
      },
    ]
  },
}

export default nextConfig
