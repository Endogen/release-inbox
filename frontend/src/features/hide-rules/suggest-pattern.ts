/** Start of a version token: a digit, optionally prefixed by "v", that begins a new word. */
const VERSION_START = /(?<![a-z0-9])v?\d/i

/**
 * Proposes a glob pattern matching all releases of the same component by replacing everything
 * from the version onwards with a wildcard: "web@1.2.3" → "web@*", "nightly-20261005" → "nightly-*".
 */
export function suggestPattern(tagName: string, name: string | null): string {
  const candidates = [tagName, name].filter((value): value is string => Boolean(value))
  for (const value of candidates) {
    const pattern = replaceVersion(value)
    if (pattern !== null && pattern !== "*") return pattern
  }
  return tagName
}

function replaceVersion(value: string): string | null {
  const match = VERSION_START.exec(value)
  return match ? `${value.slice(0, match.index)}*` : null
}
