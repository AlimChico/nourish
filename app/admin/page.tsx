import { Metadata } from "next"
import { AdminClientsPanel } from "@/components/admin-clients-panel"

export const metadata: Metadata = {
  title: "Administration — Nourish",
  description: "Tableau de Bord Administration du propriétaire — tous les clients.",
}

export default function AdminPage() {
  return (
    <div className="min-h-dvh overflow-y-auto bg-background px-5 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom,0px)+3rem)]">
      <div className="mx-auto max-w-4xl space-y-5">
        <AdminClientsPanel />

        <a href="/" className="text-xs font-bold text-primary underline">
          ← Retour à l&apos;app
        </a>
      </div>
    </div>
  )
}
