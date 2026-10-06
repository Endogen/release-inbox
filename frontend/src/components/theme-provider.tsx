import { useEffect, useMemo, useState, type ReactNode } from "react"

import { useMediaQuery } from "@/hooks/use-media-query"
import {
  DEFAULT_THEME,
  isTheme,
  THEME_STORAGE_KEY,
  ThemeContext,
  type Theme,
} from "@/lib/theme"

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(stored) ? stored : DEFAULT_THEME
  } catch {
    // Storage can be blocked (privacy settings); fall back to the default.
    return DEFAULT_THEME
  }
}

function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // The choice then only lasts for this visit.
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readStoredTheme)
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)")
  const resolvedTheme = theme === "system" ? (prefersDark ? "dark" : "light") : theme

  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark")
    document.documentElement.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme: (next: Theme) => {
        storeTheme(next)
        setTheme(next)
      },
    }),
    [theme, resolvedTheme]
  )

  return <ThemeContext value={value}>{children}</ThemeContext>
}
