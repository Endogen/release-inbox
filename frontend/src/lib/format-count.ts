const compactFormat = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
})

/** A short count such as "950", "12.4k" or "1.2M", the way GitHub shows stars. */
export function formatCount(value: number): string {
  return compactFormat.format(value).replace("K", "k")
}
