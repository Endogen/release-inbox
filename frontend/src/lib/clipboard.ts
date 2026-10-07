/** Copy text to the clipboard. Browsers only offer the clipboard on secure (HTTPS) pages. */
export async function copyToClipboard(text: string): Promise<void> {
  if (!("clipboard" in navigator)) {
    throw new Error("Copying needs a secure (HTTPS) connection.")
  }
  await navigator.clipboard.writeText(text)
}
