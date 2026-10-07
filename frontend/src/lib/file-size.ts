const UNITS = ["B", "KB", "MB", "GB", "TB"] as const

/** A file size such as "512 B", "48 MB" or "1.2 GB" (powers of 1024, like file managers). */
export function formatFileSize(bytes: number): string {
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit++
  }
  const digits = unit > 0 && value < 10 ? 1 : 0
  return `${value.toFixed(digits).replace(/\.0$/, "")} ${UNITS[unit]}`
}
