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
      {
        // APK Android (`public/downloads/*.apk`).
        //
        // Sans le bon type MIME, Chrome sert le fichier comme un blob générique
        // et Android ne propose pas « Installer ». `Content-Disposition:
        // attachment` évite en plus qu'un navigateur de bureau tente d'afficher
        // le binaire dans un onglet, et `must-revalidate` garantit qu'un nouvel
        // APK publié est bien téléchargé au lieu d'une version en cache.
        source: "/downloads/:file*.apk",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          { key: "Content-Disposition", value: 'attachment; filename="sahtek-android.apk"' },
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
    ]
  },
}

export default nextConfig
