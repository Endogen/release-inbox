import { useEffect, useRef, useState, type Ref } from "react"

import { SearchInput } from "@/components/search-input"
import { useDebouncedValue } from "@/hooks/use-debounced-value"

const DEBOUNCE_MS = 250

interface SearchBoxProps {
  ref?: Ref<HTMLInputElement>
  /** The committed search (e.g. from the URL). */
  value: string
  /** Called with the trimmed text once typing pauses. */
  onCommit: (value: string) => void
  placeholder?: string
}

/**
 * Keeps the typed text locally (so typing doesn't re-render the page) and commits it after a
 * pause. Changes of ``value`` from elsewhere, like navigating to a notification, replace the
 * text instead of being overwritten by it.
 */
export function SearchBox({ ref, value, onCommit, placeholder }: SearchBoxProps) {
  const [text, setText] = useState(value)
  const debounced = useDebouncedValue(text.trim(), DEBOUNCE_MS)
  const committed = useRef(value)

  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value
      setText(value)
    }
  }, [value])

  useEffect(() => {
    if (debounced !== committed.current) {
      committed.current = debounced
      onCommit(debounced)
    }
  }, [debounced, onCommit])

  return <SearchInput ref={ref} value={text} onChange={setText} placeholder={placeholder} />
}
