"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { MobileFrame } from "@/components/mobile-frame"
import { BottomNav, type TabKey } from "@/components/bottom-nav"
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow"
import { SplashScreen } from "@/components/splash-screen"
import { HomeScreen } from "@/components/screens/home-screen"
import { FoodScreen } from "@/components/screens/food-screen"
import { ProgressScreen } from "@/components/screens/progress-screen"
import { WorkoutScreen } from "@/components/screens/workout-screen"
import { ProfileScreen } from "@/components/screens/profile-screen"
import { CommunityFoodLogBridge } from "@/components/screens/community-screen"
import { InstallPrompt } from "@/components/install-prompt"

/**
 * Écrans NON essentiels au premier rendu : chargés à la demande (code splitting).
 * Le premier écran d'un utilisateur est le splash + le dashboard ; le scanner, la
 * communauté, le coach, les paramètres… ne pèsent donc plus sur le démarrage —
 * c'est le principal levier de vitesse sur un téléphone d'entrée de gamme (#38).
 */
// (les options de `next/dynamic` doivent être un objet littéral — d'où la
// répétition voulue de `{ ssr: false, loading: () => null }`)
const CalculatorScreen = dynamic(
  () => import("@/components/screens/calculator-screen").then((m) => m.CalculatorScreen),
  { ssr: false, loading: () => null },
)
const PremiumScreen = dynamic(() => import("@/components/screens/premium-screen").then((m) => m.PremiumScreen), {
  ssr: false,
  loading: () => null,
})
const ScanMealScreen = dynamic(
  () => import("@/components/screens/scan-meal-screen").then((m) => m.ScanMealScreen),
  { ssr: false, loading: () => null },
)
const BarcodeScannerScreen = dynamic(
  () => import("@/components/screens/barcode-scanner-screen").then((m) => m.BarcodeScannerScreen),
  { ssr: false, loading: () => null },
)
const SettingsScreen = dynamic(() => import("@/components/screens/settings-screen").then((m) => m.SettingsScreen), {
  ssr: false,
  loading: () => null,
})
const CommunityScreen = dynamic(
  () => import("@/components/screens/community-screen").then((m) => m.CommunityScreen),
  { ssr: false, loading: () => null },
)
const CoachScreen = dynamic(() => import("@/components/screens/coach-screen").then((m) => m.CoachScreen), {
  ssr: false,
  loading: () => null,
})
const LeaderboardScreen = dynamic(
  () => import("@/components/screens/leaderboard-screen").then((m) => m.LeaderboardScreen),
  { ssr: false, loading: () => null },
)
const HistoryScreen = dynamic(
  () => import("@/components/screens/history-screen").then((m) => m.HistoryScreen),
  { ssr: false, loading: () => null },
)
const TutorialFlow = dynamic(() => import("@/components/onboarding/tutorial-flow").then((m) => m.TutorialFlow), {
  ssr: false,
  loading: () => null,
})
import { ScanLine } from "lucide-react"
import { FoodLogProvider, type MealKey } from "@/lib/food-log"
import { PremiumProvider } from "@/lib/premium"
import { AccountProvider, useAccount } from "@/lib/account"
import { SyncProvider, useSync } from "@/lib/sync"
import { HealthProvider } from "@/lib/health"
import { SmartNotificationsProvider } from "@/lib/notifications"
import { AutoPushBridge } from "@/lib/auto-push"
import { WeightProvider } from "@/lib/weight"
import { markTutorialSeen, tutorialSeen } from "@/lib/tutorial"

type Overlay =
  | "none"
  | "calculator"
  | "premium"
  | "scan"
  | "barcode"
  | "settings"
  | "community"
  | "coach"
  | "leaderboard"
  | "history"

const TAB_ORDER: TabKey[] = ["home", "food", "progress", "workout", "profile"]

function App() {
  const { state, hydrated, logout } = useAccount()
  const { logout: serverLogout } = useSync()
  const [tab, setTab] = useState<TabKey>("home")
  const [overlay, setOverlay] = useState<Overlay>("none")
  // Repas visé quand on arrive sur l'onglet Food depuis le "+" d'un repas du
  // dashboard : le repas est pré-sélectionné, plus de saisie au hasard.
  const [foodMeal, setFoodMeal] = useState<MealKey | undefined>(undefined)
  // Splash plein écran au lancement (une fois par session de navigation).
  const [splash, setSplash] = useState(true)
  const hideSplash = useCallback(() => setSplash(false), [])
  // Tutoriel d'introduction : décidé APRÈS hydratation (drapeau localStorage lu
  // côté client uniquement → aucun décalage d'hydratation), montré une fois après
  // le splash, et rejouable depuis le profil.
  const [tutorial, setTutorial] = useState(false)
  useEffect(() => {
    if (hydrated && !tutorialSeen()) setTutorial(true)
  }, [hydrated])
  const closeTutorial = useCallback(() => {
    markTutorialSeen()
    setTutorial(false)
  }, [])

  // Swipe horizontal pour changer d'onglet (mobile). Ignoré quand le geste
  // démarre sur un carrousel horizontal (suggestions coach, macros…).
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current
    touchStart.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) < 70 || Math.abs(dy) > 50) return
    const idx = TAB_ORDER.indexOf(tab)
    if (dx < 0 && idx < TAB_ORDER.length - 1) setTab(TAB_ORDER[idx + 1]!)
    if (dx > 0 && idx > 0) setTab(TAB_ORDER[idx - 1]!)
  }

  if (!hydrated) {
    return (
      <>
        {splash && <SplashScreen onDone={hideSplash} />}
        {/* Contenu masqué jusqu'à l'hydratation du journal — pas de flash. */}
      </>
    )
  }

  if (!state.onboarded) {
    return (
      <MobileFrame>
        {splash && <SplashScreen onDone={hideSplash} />}
        <OnboardingFlow />
      </MobileFrame>
    )
  }

  return (
    <MobileFrame>
      {splash && <SplashScreen onDone={hideSplash} />}
      <main
        key={tab}
        // 92 px dégagent la barre de navigation ; on monte à 152 px pour que le
        // dernier élément interactif (ex. bouton « Supprimer » de l'éditeur d'un
        // repas) ne reste jamais caché sous le bouton flottant du scanner.
        className="min-h-0 flex-1 overflow-y-auto no-scrollbar pb-[calc(env(safe-area-inset-bottom,0px)+152px)] sm:pb-28"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <CommunityFoodLogBridge />
        {tab === "home" && (
          <HomeScreen
            onAddFood={(meal) => {
              if (meal) setFoodMeal(meal)
              setTab("food")
            }}
            onOpenSettings={() => setOverlay("settings")}
            onOpenCoach={() => setOverlay("coach")}
            onOpenLeaderboard={() => setOverlay("leaderboard")}
          />
        )}
        {tab === "food" && (
          <FoodScreen
            initialMeal={foodMeal}
            onOpenScan={() => setOverlay("scan")}
            onOpenBarcode={() => setOverlay("barcode")}
          />
        )}
        {tab === "progress" && <ProgressScreen onOpenHistory={() => setOverlay("history")} />}
        {tab === "workout" && <WorkoutScreen />}
        {tab === "profile" && (
          <ProfileScreen
            onOpenCalculator={() => setOverlay("calculator")}
            onOpenPremium={() => setOverlay("premium")}
            onOpenCommunity={() => setOverlay("community")}
            onOpenSettings={() => setOverlay("settings")}
            onOpenTutorial={() => setTutorial(true)}
            onOpenHistory={() => setOverlay("history")}
            onOpenProgress={() => setTab("progress")}
            onLogout={() => {
              logout()
              void serverLogout()
            }}
          />
        )}
      </main>
      <BottomNav active={tab} onChange={setTab} />
      {/* FAB scan — toujours visible sur mobile, au-dessus de la barre flottante,
          caché quand un overlay plein écran est ouvert. */}
      {overlay === "none" && (
        <button
          type="button"
          onClick={() => setOverlay("barcode")}
          aria-label="Scanner un aliment"
          className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+84px)] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_30px_rgba(52,211,153,0.45)] ring-4 ring-[#0b0f0d] transition-transform active:scale-90 sm:hidden"
        >
          <ScanLine className="h-6 w-6" strokeWidth={2.2} />
        </button>
      )}
      <InstallPrompt />

      {overlay === "calculator" && <CalculatorScreen onClose={() => setOverlay("none")} />}
      {overlay === "premium" && <PremiumScreen onClose={() => setOverlay("none")} />}
      {overlay === "scan" && <ScanMealScreen onClose={() => setOverlay("none")} />}
      {overlay === "barcode" && (
        <BarcodeScannerScreen
          onClose={() => setOverlay("none")}
          onOpenMealScan={() => setOverlay("scan")}
        />
      )}
      {overlay === "settings" && (
        <SettingsScreen onClose={() => setOverlay("none")} onOpenLeaderboard={() => setOverlay("leaderboard")} />
      )}
      {overlay === "community" && <CommunityScreen onClose={() => setOverlay("none")} />}
      {overlay === "coach" && <CoachScreen onClose={() => setOverlay("none")} />}
      {/* Ouvert depuis les paramètres ou la carte de niveau : on revient aux
          paramètres en fermant, pas sur un écran inattendu. */}
      {overlay === "leaderboard" && <LeaderboardScreen onClose={() => setOverlay("settings")} />}
      {overlay === "history" && <HistoryScreen onClose={() => setOverlay("none")} />}

      {/* Tutoriel d'intro : au-dessus de tout, après le splash, une seule fois. */}
      {tutorial && !splash && <TutorialFlow onDone={closeTutorial} />}
    </MobileFrame>
  )
}

// Le bridge d'abonnement push automatique vit au-dessus de App (splash,
// onboarding) : dès permission accordée + session, l'appareil s'abonne.
function AppShell() {
  return (
    <>
      <AutoPushBridge />
      <App />
    </>
  )
}

export default function Page() {
  return (
    <SyncProvider>
      <AccountProvider>
        <PremiumProvider>
          <FoodLogProvider>
            <HealthProvider>
              <WeightProvider>
                <SmartNotificationsProvider>
                  <AppShell />
                </SmartNotificationsProvider>
              </WeightProvider>
            </HealthProvider>
          </FoodLogProvider>
        </PremiumProvider>
      </AccountProvider>
    </SyncProvider>
  )
}
