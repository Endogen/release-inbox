import { createContext } from "react"

export type Theme = "light" | "dark" | "system"
export type ResolvedTheme = "light" | "dark"

/** Must match the inline script in index.html that applies the theme before first paint. */
export const THEME_STORAGE_KEY = "ghr-theme"
export const DEFAULT_THEME: Theme = "dark"

export interface ThemeContextValue {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system"
}
