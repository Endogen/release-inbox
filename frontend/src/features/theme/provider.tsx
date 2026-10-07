import { useEffect, useMemo, useState, type ReactNode } from "react"

import { useMediaQuery } from "@/hooks/use-media-query"
import { readStorage, writeStorage } from "@/lib/storage"

import {
  DEFAULT_THEME,
  isTheme,
  THEME_STORAGE_KEY,
  ThemeContext,
  type ResolvedTheme,
  type Theme,
} from "./context"

function readStoredTheme(): Theme {
  const stored = readStorage(THEME_STORAGE_KEY)
  return isTheme(stored) ? stored : DEFAULT_THEME
}

/** Apply the theme without animating every color on the page from the old one. */
function applyTheme(theme: ResolvedTheme): void {
  const root = document.documentElement
  if (root.classList.contains("dark") === (theme === "dark")) return
  const pause = document.createElement("style")
  pause.textContent = "*, *::before, *::after { transition: none !important; }"
  document.head.append(pause)
  root.classList.toggle("dark", theme === "dark")
  root.style.colorScheme = theme
  // Force the new styles to be computed before transitions are allowed again.
  void window.getComputedStyle(root).colorScheme
  pause.remove()
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readStoredTheme)
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)")
  const resolvedTheme = theme === "system" ? (prefersDark ? "dark" : "light") : theme

  useEffect(() => applyTheme(resolvedTheme), [resolvedTheme])

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme: (next: Theme) => {
        writeStorage(THEME_STORAGE_KEY, next)
        setTheme(next)
      },
    }),
    [theme, resolvedTheme]
  )

  return <ThemeContext value={value}>{children}</ThemeContext>
}
