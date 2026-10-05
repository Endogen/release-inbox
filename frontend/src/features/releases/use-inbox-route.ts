import { useCallback } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router"

import { VIEWS, type View } from "@/lib/api/types"

function isView(value: string | undefined): value is View {
  return VIEWS.includes(value as View)
}

function parseId(value: string | null): number | null {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

/** Inbox state kept in the URL: `/:view?q=<search>&release=<id>`. */
export function useInboxRoute() {
  const params = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const view: View = isView(params.view) ? params.view : "inbox"
  const search = searchParams.get("q") ?? ""
  const releaseId = parseId(searchParams.get("release"))

  const updateParam = useCallback(
    (key: string, value: string | null) =>
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (value) next.set(key, value)
          else next.delete(key)
          return next
        },
        { replace: true }
      ),
    [setSearchParams]
  )

  const selectRelease = useCallback(
    (id: number | null) => updateParam("release", id === null ? null : String(id)),
    [updateParam]
  )

  const setSearch = useCallback((value: string) => updateParam("q", value || null), [updateParam])

  const setView = useCallback(
    (next: View) => {
      const query = search ? `?${new URLSearchParams({ q: search })}` : ""
      navigate(`/${next}${query}`)
    },
    [navigate, search]
  )

  return { view, search, releaseId, selectRelease, setSearch, setView }
}
