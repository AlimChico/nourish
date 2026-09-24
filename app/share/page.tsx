import type { Metadata } from "next"
import { ShareLanding } from "./share-landing"

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

// Aperçu dynamique quand le lien /share est collé dans WhatsApp / iMessage / DM :
// le titre et la description reprennent le partage (plat, kcal, auteur).
// L'image d'aperçu vient de opengraph-image.tsx (convention Next, même dossier).
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams
  const title = first(sp.title)?.slice(0, 80)
  const name = first(sp.name)?.slice(0, 40)
  const calories = first(sp.calories)?.slice(0, 6)

  const ogTitle = title
    ? `${title} — ${calories ? `${calories} kcal · ` : ""}Sahtek 🇹🇳`
    : "Rejoins-moi sur Sahtek 🇹🇳"
  const ogDescription = name
    ? `${name} suit ses calories sur Sahtek — scanne tes plats tunisiens et atteins ton objectif.`
    : "Suis tes calories, scanne tes plats tunisiens et atteins ton objectif — l'app nutrition made in Tunisia."

  return {
    title: ogTitle,
    description: ogDescription,
    openGraph: { title: ogTitle, description: ogDescription },
  }
}

export default function SharePage() {
  return <ShareLanding />
}
