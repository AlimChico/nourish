"use client"

import { useState } from "react"
import { MobileFrame } from "@/components/mobile-frame"
import { BottomNav, type TabKey } from "@/components/bottom-nav"
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow"
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
import { InstallPrompt } from "@/components/install-prompt"
import { FoodLogProvider } from "@/lib/food-log"
import { PremiumProvider } from "@/lib/premium"
import { AccountProvider, useAccount } from "@/lib/account"
import { SyncProvider, useSync } from "@/lib/sync"
import { HealthProvider } from "@/lib/health"
import { SmartNotificationsProvider } from "@/lib/notifications"
import { WeightProvider } from "@/lib/weight"

type Overlay = "none" | "calculator" | "premium" | "scan" | "barcode" | "settings" | "community"

function App() {
  const { state, hydrated, logout } = useAccount()
  const { logout: serverLogout } = useSync()
  const [tab, setTab] = useState<TabKey>("home")
  const [overlay, setOverlay] = useState<Overlay>("none")

  if (!hydrated) return null

  if (!state.onboarded) {
    return (
      <MobileFrame>
        <OnboardingFlow />
      </MobileFrame>
    )
  }

  return (
    <MobileFrame>
      <main key={tab} className="flex-1 overflow-y-auto no-scrollbar animate-slide-up">
        <CommunityFoodLogBridge />
        {tab === "home" && (
          <HomeScreen
            onAddFood={() => setTab("food")}
            onOpenScan={() => setOverlay("barcode")}
            onOpenSettings={() => setOverlay("settings")}
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
      <InstallPrompt />

      {overlay === "calculator" && <CalculatorScreen onClose={() => setOverlay("none")} />}
      {overlay === "premium" && <PremiumScreen onClose={() => setOverlay("none")} />}
      {overlay === "scan" && <ScanMealScreen onClose={() => setOverlay("none")} />}
      {overlay === "barcode" && <BarcodeScannerScreen onClose={() => setOverlay("none")} />}
      {overlay === "settings" && <SettingsScreen onClose={() => setOverlay("none")} />}
      {overlay === "community" && <CommunityScreen onClose={() => setOverlay("none")} />}
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
