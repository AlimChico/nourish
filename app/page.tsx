"use client"

import { useCallback, useRef, useState } from "react"
import { MobileFrame } from "@/components/mobile-frame"
import { BottomNav, type TabKey } from "@/components/bottom-nav"
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow"
import { SplashScreen } from "@/components/splash-screen"
import { HomeScreen } from "@/components/screens/home-screen"
import { FoodScreen } from "@/components/screens/food-screen"
import { ProgressScreen } from "@/components/screens/progress-screen"
import { WorkoutScreen } from "@/components/screens/workout-screen"
import { ProfileScreen } from "@/components/screens/profile-screen"
import { CalculatorScreen } from "@/components/screens/calculator-screen"
import { PremiumScreen } from "@/components/screens/premium-screen"
import { ScanMealScreen } from "@/components/screens/scan-meal-screen"
import { BarcodeScannerScreen } from "@/components/screens/barcode-scanner-screen"
import { SettingsScreen } from "@/components/screens/settings-screen"
import { CommunityScreen, CommunityFoodLogBridge } from "@/components/screens/community-screen"
import { CoachScreen } from "@/components/screens/coach-screen"
import { InstallPrompt } from "@/components/install-prompt"
import { ScanLine } from "lucide-react"
import { FoodLogProvider } from "@/lib/food-log"
import { PremiumProvider } from "@/lib/premium"
import { AccountProvider, useAccount } from "@/lib/account"
import { SyncProvider, useSync } from "@/lib/sync"
import { HealthProvider } from "@/lib/health"
import { SmartNotificationsProvider } from "@/lib/notifications"
import { WeightProvider } from "@/lib/weight"

type Overlay = "none" | "calculator" | "premium" | "scan" | "barcode" | "settings" | "community" | "coach"

const TAB_ORDER: TabKey[] = ["home", "food", "progress", "workout", "profile"]

function App() {
  const { state, hydrated, logout } = useAccount()
  const { logout: serverLogout } = useSync()
  const [tab, setTab] = useState<TabKey>("home")
  const [overlay, setOverlay] = useState<Overlay>("none")
  // Splash plein écran au lancement (une fois par session de navigation).
  const [splash, setSplash] = useState(true)
  const hideSplash = useCallback(() => setSplash(false), [])

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
        className="flex-1 overflow-y-auto no-scrollbar animate-slide-up"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <CommunityFoodLogBridge />
        {tab === "home" && (
          <HomeScreen
            onAddFood={() => setTab("food")}
            onOpenSettings={() => setOverlay("settings")}
            onOpenCoach={() => setOverlay("coach")}
          />
        )}
        {tab === "food" && <FoodScreen onOpenScan={() => setOverlay("scan")} onOpenBarcode={() => setOverlay("barcode")} />}
        {tab === "progress" && <ProgressScreen />}
        {tab === "workout" && <WorkoutScreen />}
        {tab === "profile" && (
          <ProfileScreen
            onOpenCalculator={() => setOverlay("calculator")}
            onOpenPremium={() => setOverlay("premium")}
            onOpenCommunity={() => setOverlay("community")}
            onOpenSettings={() => setOverlay("settings")}
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
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+86px)] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_30px_rgba(52,211,153,0.45)] ring-4 ring-[#0b0f0d] transition-transform active:scale-90 sm:hidden"
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
      {overlay === "settings" && <SettingsScreen onClose={() => setOverlay("none")} />}
      {overlay === "community" && <CommunityScreen onClose={() => setOverlay("none")} />}
      {overlay === "coach" && <CoachScreen onClose={() => setOverlay("none")} />}
    </MobileFrame>
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
                  <App />
                </SmartNotificationsProvider>
              </WeightProvider>
            </HealthProvider>
          </FoodLogProvider>
        </PremiumProvider>
      </AccountProvider>
    </SyncProvider>
  )
}
