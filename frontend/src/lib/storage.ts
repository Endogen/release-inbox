// Browsers can block storage (privacy settings) or run out of space. Preferences kept here are
// a convenience: without storage they fall back to their defaults and last for this visit.

export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Kept in memory only.
  }
}
