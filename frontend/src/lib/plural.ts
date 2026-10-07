/** "1 release", "3 releases". */
export function plural(count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`
}
