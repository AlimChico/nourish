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
    <main className="mx-auto max-w-2xl px-6 py-12 leading-relaxed">
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
        <li className={LI}>Vendre tes données personnelles ou de santé à des tiers.</li>
        <li className={LI}>Partager tes repas, ton poids ou tes objectifs avec d&apos;autres utilisateurs.</li>
        <li className={LI}>Utiliser tes photos pour entraîner des modèles d&apos;IA.</li>
      </ul>

      <h2 className={H2}>3. Publicité (AdSense)</h2>
      <p className={P}>
        Sahtek est financée en partie par Google AdSense, réservé aux comptes gratuits et affiché hors des zones de
        saisie. Google peut utiliser des cookies publicitaires selon ses propres règles :
        <a className="font-semibold text-emerald-400" href="https://policies.google.com/technologies/ads" target="_blank" rel="noreferrer">
          {" "}policies.google.com/technologies/ads
        </a>
        . Les membres Premium ne voient aucune publicité.
      </p>

      <h2 className={H2}>4. Partage social & stories</h2>
      <p className={P}>
        Les cartes partagées vers Instagram/TikTok sont générées <em>sur ton appareil</em> à partir des informations que
        tu choisis (recette, streak, calories). Rien n&apos;est envoyé à nos serveurs lors d&apos;un partage. Les liens
        de partage pointent vers une page publique qui n&apos;expose que le contenu partagé volontairement.
      </p>

      <h2 className={H2}>5. Connexion Google / Apple</h2>
      <p className={P}>
        Si tu utilises &quot;Continuer avec Google/Apple&quot;, nous recevons uniquement ton nom et ton e-mail du
        fournisseur. Aucun mot de passe ne transite par Sahtek. La connexion se fait via les flux officiels OAuth 2.0
        (PKCE). Tu peux révoquer l&apos;accès à tout moment depuis ton compte Google/Apple.
      </p>

      <h2 className={H2}>6. Tes droits</h2>
      <ul className="mt-2">
        <li className={LI}><strong className="text-[#cfe8db]">Exporter</strong> : Réglages → Exporter mes données (JSON complet).</li>
        <li className={LI}>
          <strong className="text-[#cfe8db]">Supprimer</strong> : Réglages → Compte → Supprimer mon compte. Effacement
          définitif du serveur et de l&apos;appareil, sans délai.
        </li>
        <li className={LI}>
          <strong className="text-[#cfe8db]">Questions</strong> : écris à{" "}
          <a className="font-semibold text-emerald-400" href="mailto:privacy@sahtek.app">privacy@sahtek.app</a> — réponse
          sous 72 h.
        </li>
      </ul>

      <h2 className={H2}>7. Notifications</h2>
      <p className={P}>
        Les rappels (calories du jour, streak, hydratation) sont activés uniquement avec ta permission et désactivables
        dans Réglages → Notifications. Ils sont générés sur ton appareil — aucun serveur ne t&apos;envoie de messages.
      </p>

      <h2 className={H2}>8. Cookies</h2>
      <p className={P}>
        Sahtek utilise un seul cookie strictement nécessaire : ta session de connexion (HttpOnly, SameSite=Lax). Aucun
        cookie de tracking propre à Sahtek. Les cookies publicitaires Google sont régis par la section 3.
      </p>

      <p className="mt-12 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs leading-relaxed text-[#9fb8ab]">
        Sahtek v2.0.0 · Édité par l&apos;équipe Sahtek, Tunisie · contact@sahtek.app · Les données de santé restent ta
        propriété exclusive.
      </p>
    </main>
  )
}
