import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Politique de confidentialité — Sahtek",
  description: "Comment Sahtek collecte, utilise et protège tes données.",
}

const H2 = "mt-8 text-lg font-extrabold text-[#e6fff1]"
const P = "mt-2 text-sm leading-relaxed text-[#9fb8ab]"
const LI = "mt-1.5 list-disc pl-5 text-sm leading-relaxed text-[#9fb8ab]"

export default function PrivacyPage() {
  return (
    // Le body est overflow:hidden (shell app) : la page scrolle dans son propre
    // conteneur, avec la safe-area iOS en haut et en bas.
    <div className="h-dvh overflow-y-auto overscroll-contain bg-background">
      <main
        className="mx-auto max-w-2xl px-6 leading-relaxed"
        style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 1rem)", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 3rem)" }}
      >
        <a href="/" className="text-xs font-bold text-emerald-400">
          ← Retour à Sahtek
        </a>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-[#e6fff1]">Politique de confidentialité</h1>
        <p className="mt-2 text-sm text-[#9fb8ab]">
          Sahtek — Ton coach nutrition tunisien 🇹🇳 · Dernière mise à jour : 24 septembre 2026
        </p>

        <h2 className={H2}>1. Ce que nous collectons</h2>
        <ul className="mt-2">
          <li className={LI}>
            <strong className="text-[#cfe8db]">Compte</strong> : nom, e-mail, mot de passe (haché avec bcrypt — jamais
            stocké en clair).
          </li>
          <li className={LI}>
            <strong className="text-[#cfe8db]">Données de santé</strong> : poids, objectifs, repas, eau, pas, séances —
            que tu saisis ou synchronises, stockées dans ta base privée (Supabase, chiffrée en transit).
          </li>
          <li className={LI}>
            <strong className="text-[#cfe8db]">Photos de repas</strong> : envoyées à notre service d&apos;analyse IA pour
            estimer les calories. Elles ne sont ni stockées sur nos serveurs ni partagées.
          </li>
          <li className={LI}>
            <strong className="text-[#cfe8db]">Usage technique</strong> : journaux serveur minimaux (adresse IP
            temporaire pour la sécurité et la limitation de débit).
          </li>
        </ul>

        <h2 className={H2}>2. Ce que nous ne faisons JAMAIS</h2>
        <ul className="mt-2">
          <li className={LI}>Vendre tes données personnelles, sans exception.</li>
          <li className={LI}>Afficher de la publicité dans tes journaux de repas ou tes données de santé.</li>
          <li className={LI}>Utiliser tes photos de repas pour entraîner des modèles d&apos;IA.</li>
          <li className={LI}>Partager tes données avec des tiers sans ton consentement explicite.</li>
        </ul>

        <h2 className={H2}>3. Où vivent tes données</h2>
        <ul className="mt-2">
          <li className={LI}>
            <strong className="text-[#cfe8db]">Sur ton appareil</strong> : repas, poids, objectifs et préférences sont
            stockés localement — l&apos;app fonctionne sans connexion.
          </li>
          <li className={LI}>
            <strong className="text-[#cfe8db]">Cloud (si tu crées un compte)</strong> : une copie chiffrée te permet de
            retrouver tes données sur un autre appareil. Hébergement Vercel + Supabase (Union Européenne).
          </li>
          <li className={LI}>
            <strong className="text-[#cfe8db]">Suppression</strong> : tout supprimer depuis Réglages → Compte efface
            aussi la copie cloud, définitivement.
          </li>
        </ul>

        <h2 className={H2}>4. Services tiers</h2>
        <ul className="mt-2">
          <li className={LI}>
            <strong className="text-[#cfe8db]">Open Food Facts</strong> : base produits collaborative, requêtes sans
            données personnelles.
          </li>
          <li className={LI}>
            <strong className="text-[#cfe8db]">Analyse de photos (IA)</strong> : le modèle vision reçoit la photo du plat,
            l&apos;estime en macros, puis l&apos;image est abandonnée.
          </li>
          <li className={LI}>
            <strong className="text-[#cfe8db]">Google AdSense</strong> : annonces contextuelles (sans données de santé).
          </li>
        </ul>

        <h2 className={H2}>5. Tes droits</h2>
        <p className={P}>
          Accès, rectification, portabilité, suppression : tout est gérable dans l&apos;app. Pour toute question :
          privacy@sahtek.app
        </p>

        <h2 className={H2}>6. Cookies</h2>
        <p className={P}>
          Uniquement un cookie de session essentiel (connexion) et le stockage local de l&apos;app. Pas de traceurs
          publicitaires tiers.
        </p>
      </main>
    </div>
  )
}
