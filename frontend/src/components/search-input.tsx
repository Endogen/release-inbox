import { SearchIcon, XIcon } from "lucide-react"
import type { Ref } from "react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"

interface SearchInputProps {
  ref?: Ref<HTMLInputElement>
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchInput({ ref, value, onChange, placeholder }: SearchInputProps) {
  return (
    <InputGroup className="bg-muted/40">
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput
        ref={ref}
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label="Search releases"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            if (value) onChange("")
            else event.currentTarget.blur()
          }
        }}
      />
      <InputGroupAddon align="inline-end">
        {value ? (
          <InputGroupButton size="icon-xs" aria-label="Clear search" onClick={() => onChange("")}>
            <XIcon />
          </InputGroupButton>
        ) : (
          <Kbd>/</Kbd>
        )}
      </InputGroupAddon>
    </InputGroup>
  )
}
