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
import { SettingsScreen } from "@/components/screens/settings-screen"
import { FoodLogProvider } from "@/lib/food-log"
import { PremiumProvider } from "@/lib/premium"
import { AccountProvider, useAccount } from "@/lib/account"
import { HealthProvider } from "@/lib/health"
import { SmartNotificationsProvider } from "@/lib/notifications"

type Overlay = "none" | "calculator" | "premium" | "scan" | "settings"

function App() {
  const { state, hydrated, logout } = useAccount()
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
        {tab === "home" && (
          <HomeScreen
            onAddFood={() => setTab("food")}
            onOpenScan={() => setOverlay("scan")}
          />
        )}
        {tab === "food" && <FoodScreen onOpenScan={() => setOverlay("scan")} />}
        {tab === "progress" && <ProgressScreen />}
        {tab === "workout" && <WorkoutScreen />}
        {tab === "profile" && (
          <ProfileScreen
            onOpenCalculator={() => setOverlay("calculator")}
            onOpenPremium={() => setOverlay("premium")}
            onOpenSettings={() => setOverlay("settings")}
            onLogout={logout}
          />
        )}
      </main>
      <BottomNav active={tab} onChange={setTab} />

      {overlay === "calculator" && <CalculatorScreen onClose={() => setOverlay("none")} />}
      {overlay === "premium" && <PremiumScreen onClose={() => setOverlay("none")} />}
      {overlay === "scan" && <ScanMealScreen onClose={() => setOverlay("none")} />}
      {overlay === "settings" && <SettingsScreen onClose={() => setOverlay("none")} />}
    </MobileFrame>
  )
}

export default function Page() {
  return (
    <AccountProvider>
      <PremiumProvider>
        <FoodLogProvider>
          <HealthProvider>
            <SmartNotificationsProvider>
              <App />
            </SmartNotificationsProvider>
          </HealthProvider>
        </FoodLogProvider>
      </PremiumProvider>
    </AccountProvider>
  )
}
