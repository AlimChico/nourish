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
    // La zone système (barre de statut, Dynamic Island, home indicator) doit
    // toujours porter la couleur exacte du fond de l'app — sinon bandes.
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0b0f0d" : "#f2faf6")
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
