import { useCallback } from "react"
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router"

import { isView, type View } from "@/lib/api/types"

/** The path of a view, keeping the search. */
export function viewPath(view: View, search: string): string {
  return search ? `/${view}?${new URLSearchParams({ q: search })}` : `/${view}`
}

interface RouteState {
  /** The release was opened from the list with a new history entry (mobile layout). */
  openedFromList?: boolean
}

function parseId(value: string | null): number | null {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

/** Inbox state kept in the URL: `/:view?q=<search>&release=<id>`. */
export function useInboxRoute() {
  const params = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const view: View = isView(params.view) ? params.view : "inbox"
  const search = searchParams.get("q") ?? ""
  const releaseId = parseId(searchParams.get("release"))
  const openedFromList = (location.state as RouteState | null)?.openedFromList === true

  const updateParam = useCallback(
    (key: string, value: string | null, options: { push?: boolean; state?: RouteState } = {}) =>
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (value) next.set(key, value)
          else next.delete(key)
          return next
        },
        { replace: !options.push, state: options.state }
      ),
    [setSearchParams]
  )

  /**
   * Select a release. ``push`` adds a history entry, so the system back gesture returns to the
   * list (used when opening the full-screen detail on mobile).
   */
  const selectRelease = useCallback(
    (id: number | null, { push = false }: { push?: boolean } = {}) =>
      updateParam("release", id === null ? null : String(id), {
        push,
        state: push ? { openedFromList: true } : { openedFromList },
      }),
    [updateParam, openedFromList]
  )

  /** Leave the detail: go back in history if it was opened from the list, else deselect. */
  const closeRelease = useCallback(() => {
    if (openedFromList) navigate(-1)
    else updateParam("release", null)
  }, [navigate, openedFromList, updateParam])

  const setSearch = useCallback((value: string) => updateParam("q", value || null), [updateParam])

  const setView = useCallback((next: View) => navigate(viewPath(next, search)), [navigate, search])

  return { view, search, releaseId, selectRelease, closeRelease, setSearch, setView }
}
