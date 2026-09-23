"use client"

import { useEffect, useState } from "react"

const KEY = "nourish.theme.v1"

export type Theme = "light" | "dark"

export function useTheme() {
  const [theme, setTheme] = useState<Theme | null>(null)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY)
      setTheme(saved === "light" ? "light" : "dark")
    } catch {
      setTheme("dark")
    }
  }, [])

  useEffect(() => {
    if (!theme) return
    const root = document.documentElement
    root.classList.toggle("dark", theme === "dark")
    root.classList.toggle("light", theme === "light")
    try {
      window.localStorage.setItem(KEY, theme)
    } catch {
      // storage unavailable
    }
  }, [theme])

  return {
    theme: theme ?? "dark",
    resolved: theme !== null,
    setTheme,
    toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
  }
}
