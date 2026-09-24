import type { Metadata } from "next"
import { ShareLanding } from "./share-landing"

export const metadata: Metadata = {
  title: "Rejoins-moi sur Sahtek 🇹🇳",
  description:
    "Suis tes calories, scanne tes plats tunisiens et atteins ton objectif — l'app nutrition made in Tunisia.",
}

export default function SharePage() {
  return <ShareLanding />
}
