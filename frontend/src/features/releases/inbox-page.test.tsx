// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@/components/ui/tooltip"
import { makeListItem } from "@/test/fixtures"

import { DeferredActionsProvider } from "./deferred-actions/provider"
import { InboxPage } from "./inbox-page"
import { releaseKeys } from "./query-keys"

vi.mock("@/features/shell/app-header", () => ({ AppHeader: () => null }))
vi.mock("@/features/sync/sync-banner", () => ({ SyncBanner: () => null }))
vi.mock("@/features/summaries/summary-panel", () => ({ SummaryPanel: () => null }))

const fetchMock = vi.fn()
const release = makeListItem()
let listStatus = 200
let detailStatus = 200

function renderInbox(path = "/inbox") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <DeferredActionsProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/:view" element={<InboxPage username="test" />} />
            </Routes>
          </MemoryRouter>
        </DeferredActionsProvider>
      </TooltipProvider>
    </QueryClientProvider>
  )
  return client
}

beforeEach(() => {
  listStatus = 200
  detailStatus = 200
  localStorage.clear()
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  )
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    }
  )
  Element.prototype.scrollIntoView = vi.fn()
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (url: string) => {
    const path = new URL(url, "http://localhost").pathname
    if (path === "/api/releases")
      return listStatus === 200
        ? Response.json({ items: [release], total: 1 })
        : Response.json({ detail: "Offline" }, { status: listStatus })
    if (path === "/api/releases/1")
      return detailStatus === 200
        ? Response.json({ ...release, body: "Release notes loaded", hide_rules: [] })
        : Response.json({ detail: "Unavailable" }, { status: detailStatus })
    if (path === "/api/releases/counts")
      return Response.json({ inbox: 1, read: 0, snoozed: 0, hidden: 0 })
    if (path === "/api/preferences")
      return Response.json({
        app_badge: false,
        mark_read_after_viewing: false,
        prereleases: "show",
      })
    if (path === "/api/repositories/10/releases") return Response.json([release])
    if (path === "/api/releases/1/assets") return Response.json([])
    throw new Error(`Unexpected request: ${url}`)
  })
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(cleanup)

describe("inbox request failures", () => {
  it("shows a failed list request and lets the user retry", async () => {
    listStatus = 503
    renderInbox()
    expect(await screen.findByText("Couldn't load releases")).toBeTruthy()
    listStatus = 200
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("acme/app")).toBeTruthy()
  })

  it("shows a failed detail request even when the release is in the list, and retries", async () => {
    detailStatus = 503
    renderInbox("/inbox?release=1")
    expect(await screen.findByText("Couldn't load the release")).toBeTruthy()
    detailStatus = 200
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("Release notes loaded")).toBeTruthy()
  })

  it("shows a deleted release and still lets a mobile user return to the list", async () => {
    detailStatus = 404
    renderInbox("/inbox?release=1")
    expect(await screen.findByText("Release not found")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Back to list" }))
    await waitFor(() => expect(screen.queryByText("Release not found")).toBeNull())
  })

  it("keeps loaded notes and list entries when a background refresh fails", async () => {
    const client = renderInbox("/inbox?release=1")
    expect(await screen.findByText("Release notes loaded")).toBeTruthy()
    listStatus = 503
    detailStatus = 503
    await act(async () => {
      await client.invalidateQueries({ queryKey: releaseKeys.all })
    })
    await waitFor(() => {
      expect(client.getQueryState(releaseKeys.detail(1))?.status).toBe("error")
      expect(client.getQueryState(releaseKeys.list("inbox", ""))?.status).toBe("error")
    })
    expect(screen.getByText("Release notes loaded")).toBeTruthy()
    expect(screen.queryByText("Couldn't load the release")).toBeNull()
    expect(screen.queryByText("Couldn't load releases")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Back to list" }))
    expect(await screen.findByText("acme/app")).toBeTruthy()
  })
})
