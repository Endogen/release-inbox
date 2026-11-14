// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"

import { version } from "../../../package.json"
import { SettingsSheet } from "./settings-sheet"

const { isDesktop, getVersion } = vi.hoisted(() => ({ isDesktop: vi.fn(), getVersion: vi.fn() }))
vi.mock("@/lib/desktop", () => ({ isDesktop }))
vi.mock("@tauri-apps/api/app", () => ({ getVersion }))
vi.mock("./notification-settings", () => ({ NotificationSettings: () => null }))
vi.mock("./inbox-settings", () => ({ InboxSettings: () => null }))
vi.mock("./display-options", () => ({ DisplayOptions: () => null }))
vi.mock("./desktop-settings", () => ({ DesktopSettings: () => null }))

function openSettings(desktop: boolean) {
  isDesktop.mockReturnValue(desktop)
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SettingsSheet open onOpenChange={() => {}} />
    </QueryClientProvider>
  )
}

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

it("shows the web build version in browser settings without calling the desktop", () => {
  openSettings(false)
  expect(screen.getByText(`Web app v${version}`)).toBeTruthy()
  expect(getVersion).not.toHaveBeenCalled()
})

it("also identifies the installed desktop version when it differs from the web build", async () => {
  getVersion.mockResolvedValue("1.2.3")
  openSettings(true)
  expect(await screen.findByText("Desktop v1.2.3")).toBeTruthy()
  expect(screen.getByText(`Web app v${version}`)).toBeTruthy()
})

it("keeps the web version visible when an older desktop cannot report its version", async () => {
  getVersion.mockRejectedValue(new Error("Permission unavailable"))
  openSettings(true)
  expect(await screen.findByText("Desktop version unavailable")).toBeTruthy()
  expect(screen.getByText(`Web app v${version}`)).toBeTruthy()
})
