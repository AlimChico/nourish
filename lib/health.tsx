"use client"

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"

/**
 * Health tracking: daily steps + workout minutes.
 *
 * Steps come from the phone's motion sensors when available (DeviceMotion API —
 * iOS Safari asks for "Motion & Fitness" permission, exactly like HealthKit
 * apps do; Android Chrome reports directly). A lightweight peak-detection
 * pedometer converts accelerometer peaks into steps. Everywhere sensors are
 * unavailable (desktop), the user can add steps/workout manually — entries are
 * tagged with their source.
 */

export type HealthSource = "sensor" | "manual"

export type HealthDay = {
  steps: number
  workoutMinutes: number
  sensorSteps: number // subset of steps measured by the device
}

export type HealthState = {
  days: Record<string, HealthDay>
}

const STORAGE_KEY = "nourish.health.v1"
const MAX_DAYS = 365

function todayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

function emptyDay(): HealthDay {
  return { steps: 0, workoutMinutes: 0, sensorSteps: 0 }
}

function normalize(raw: unknown): HealthState {
  const days: Record<string, HealthDay> = {}
  if (raw && typeof raw === "object" && (raw as HealthState).days && typeof (raw as HealthState).days === "object") {
    for (const [date, day] of Object.entries((raw as HealthState).days)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !day || typeof day !== "object") continue
      days[date] = {
        steps: Math.max(0, Math.round(Number(day.steps) || 0)),
        workoutMinutes: Math.max(0, Math.round(Number(day.workoutMinutes) || 0)),
        sensorSteps: Math.max(0, Math.round(Number(day.sensorSteps) || 0)),
      }
    }
  }
  // cap history
  const dates = Object.keys(days).sort().slice(-MAX_DAYS)
  return { days: Object.fromEntries(dates.map((d) => [d, days[d]])) }
}

type Store = {
  state: HealthState
  hydrated: boolean
  today: HealthDay
  sensorAvailable: boolean
  sensorPermission: "unknown" | "granted" | "denied" | "unavailable"
  /** Extra steps measured by the phone sensors since the page opened (already merged into today). */
  addSteps: (n: number, source?: HealthSource) => void
  addWorkout: (minutes: number) => void
  enableSensor: () => Promise<void>
}

const HealthContext = createContext<Store | null>(null)

export function HealthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<HealthState>({ days: {} })
  const [hydrated, setHydrated] = useState(false)
  const [sensorPermission, setSensorPermission] = useState<Store["sensorPermission"]>("unknown")
  const sessionSteps = useRef(0)

  const sensorAvailable =
    typeof window !== "undefined" &&
    (typeof DeviceMotionEvent !== "undefined" || "Accelerometer" in window)

  useEffect(() => {
    try {
      setState(normalize(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null")))
    } catch {
      setState({ days: {} })
    }
    setSensorPermission(sensorAvailable ? "unknown" : "unavailable")
    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // storage unavailable
    }
  }, [state, hydrated])

  const mutateToday = (fn: (day: HealthDay) => HealthDay) => {
    setState((s) => {
      const date = todayKey()
      const current = s.days[date] ?? emptyDay()
      return { days: { ...s.days, [date]: fn(current) } }
    })
  }

  const store = useMemo<Store>(
    () => ({
      state,
      hydrated,
      today: state.days[todayKey()] ?? emptyDay(),
      sensorAvailable,
      sensorPermission,
      addSteps: (n, source = "manual") => {
        if (n <= 0) return
        if (source === "sensor") sessionSteps.current += n
        mutateToday((d) => ({
          steps: d.steps + n,
          workoutMinutes: d.workoutMinutes,
          sensorSteps: source === "sensor" ? d.sensorSteps + n : d.sensorSteps,
        }))
      },
      addWorkout: (minutes) => {
        if (minutes <= 0) return
        mutateToday((d) => ({ ...d, workoutMinutes: Math.max(0, d.workoutMinutes + minutes) }))
      },
      enableSensor: async () => {
        if (!sensorAvailable) {
          setSensorPermission("unavailable")
          return
        }
        try {
          // iOS Safari requires an explicit user gesture to unlock motion data.
          const DM = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<"granted" | "denied"> }
          if (typeof DM?.requestPermission === "function") {
            const res = await DM.requestPermission()
            setSensorPermission(res === "granted" ? "granted" : "denied")
            if (res !== "granted") return
          } else {
            setSensorPermission("granted")
          }
          startPedometer((steps) => store.addSteps(steps, "sensor"))
        } catch {
          setSensorPermission("denied")
        }
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, hydrated, sensorAvailable, sensorPermission],
  )

  return <HealthContext.Provider value={store}>{children}</HealthContext.Provider>
}

/**
 * Minimal peak-detection pedometer: listens to DeviceMotion, counts an
 * acceleration peak every ~250-2000 ms window as one step. Good enough for
 * pocket/hand walking; far below HealthKit accuracy but fully local.
 */
function startPedometer(onSteps: (n: number) => void) {
  if (typeof window === "undefined" || typeof DeviceMotionEvent === "undefined") return
  let lastPeakAt = 0
  let lastMagnitude = 9.81
  let baseline = 9.81
  let buffer = 0
  let flushAt = 0

  const onMotion = (event: DeviceMotionEvent) => {
    const acc = event.accelerationIncludingGravity
    if (!acc || acc.y === null || acc.y === undefined) return
    const magnitude = Math.sqrt((acc.x ?? 0) ** 2 + (acc.y ?? 0) ** 2 + (acc.z ?? 0) ** 2)
    baseline = baseline * 0.98 + magnitude * 0.02 // slow-moving average
    const delta = magnitude - lastMagnitude
    lastMagnitude = magnitude
    const now = Date.now()

    // A step is an upward spike of > 1.2 m/s² above baseline, at most ~3.5 Hz.
    if (delta > 0 && magnitude - baseline > 1.2 && now - lastPeakAt > 280) {
      lastPeakAt = now
      buffer += 1
    }
    if (now > flushAt) {
      if (buffer > 0) onSteps(buffer)
      buffer = 0
      flushAt = now + 4000 // flush every 4 s to limit re-renders
    }
  }

  window.addEventListener("devicemotion", onMotion)
}

export function useHealth(): Store {
  const ctx = useContext(HealthContext)
  if (!ctx) throw new Error("useHealth must be used inside <HealthProvider>")
  return ctx
}
