import { SearchIcon, XIcon } from "lucide-react"
import { useEffect, useRef, useState, type Ref } from "react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"
import { useDebouncedValue } from "@/hooks/use-debounced-value"

const DEBOUNCE_MS = 250

interface SearchBoxProps {
  ref?: Ref<HTMLInputElement>
  /** The committed search (e.g. from the URL). */
  value: string
  /** Called with the trimmed text once typing pauses. */
  onCommit: (value: string) => void
}

/**
 * Keeps the typed text locally (so typing doesn't re-render the page) and commits it after a
 * pause. Changes of ``value`` from elsewhere, like opening a notification, replace the text
 * instead of being overwritten by it.
 */
export function SearchBox({ ref, value, onCommit }: SearchBoxProps) {
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

  return (
    <InputGroup className="bg-muted/40">
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput
        ref={ref}
        type="search"
        enterKeyHint="search"
        value={text}
        placeholder="Search releases"
        aria-label="Search releases"
        // Chrome and Safari add their own clear button; the one below works in every browser.
        className="[&::-webkit-search-cancel-button]:hidden"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return
          if (text) setText("")
          else event.currentTarget.blur()
        }}
      />
      <InputGroupAddon align="inline-end">
        {text ? (
          <InputGroupButton size="icon-xs" aria-label="Clear search" onClick={() => setText("")}>
            <XIcon />
          </InputGroupButton>
        ) : (
          // The shortcut needs a keyboard; touch screens have no use for the hint.
          <Kbd className="pointer-coarse:hidden">/</Kbd>
        )}
      </InputGroupAddon>
    </InputGroup>
  )
}
