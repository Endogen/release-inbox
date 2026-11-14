// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { DesktopSettings } from "./desktop-settings"

const invoke = vi.hoisted(() => vi.fn())
vi.mock("@tauri-apps/api/core", () => ({ invoke, isTauri: () => true }))

function settings() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <DesktopSettings />
    </QueryClientProvider>
  )
}

beforeEach(() => invoke.mockReset())
afterEach(cleanup)

it("saves Minimize to tray using the desktop settings switch", async () => {
  invoke
    .mockResolvedValueOnce({ tray_enabled: true, minimize_to_tray: false })
    .mockResolvedValueOnce({ tray_enabled: true, minimize_to_tray: true })
    .mockResolvedValueOnce({ tray_enabled: true, minimize_to_tray: false })
  settings()
  const toggle = await screen.findByRole("switch", { name: "Minimize to tray" })
  for (const enabled of [true, false]) {
    fireEvent.click(toggle)
    await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe(String(enabled)))
    expect(invoke).toHaveBeenLastCalledWith("set_minimize_to_tray", { enabled })
  }
})

it("makes Minimize to tray unavailable while the tray is disabled", async () => {
  invoke.mockResolvedValueOnce({ tray_enabled: false, minimize_to_tray: true })
  settings()
  const toggle = await screen.findByRole("switch", { name: "Minimize to tray" })
  expect(toggle.hasAttribute("disabled")).toBe(true)
  expect(toggle.getAttribute("aria-checked")).toBe("false")
})

it("explains how to enable Minimize to tray on an older desktop build", async () => {
  invoke.mockResolvedValueOnce({ tray_enabled: true })
  settings()
  const toggle = await screen.findByRole("switch", { name: "Minimize to tray" })
  expect(toggle.hasAttribute("disabled")).toBe(true)
  expect(screen.getByText(/Update the desktop app to use this option/)).toBeTruthy()
})

it("reads the native preference and can turn a disabled tray back on", async () => {
  invoke
    .mockResolvedValueOnce({ tray_enabled: false })
    .mockResolvedValueOnce({ tray_enabled: true })
  settings()
  const toggle = await screen.findByRole("switch", { name: "Enable tray icon" })
  expect(invoke).toHaveBeenCalledWith("desktop_settings")
  expect(toggle.getAttribute("aria-checked")).toBe("false")
  fireEvent.click(toggle)
  await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("true"))
  expect(invoke).toHaveBeenLastCalledWith("set_tray_enabled", { enabled: true })
})

it("disables the tray and explains that closing the window now quits", async () => {
  invoke
    .mockResolvedValueOnce({ tray_enabled: true })
    .mockResolvedValueOnce({ tray_enabled: false })
  settings()
  const toggle = await screen.findByRole("switch", { name: "Enable tray icon" })
  fireEvent.click(toggle)
  await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("false"))
  expect(invoke).toHaveBeenLastCalledWith("set_tray_enabled", { enabled: false })
  expect(screen.getByText(/Closing the window quits it/)).toBeTruthy()
})

it("retains the saved preference when the native change fails and allows retry", async () => {
  invoke
    .mockResolvedValueOnce({ tray_enabled: true })
    .mockRejectedValueOnce("Couldn't save the settings")
  settings()
  const toggle = await screen.findByRole("switch", { name: "Enable tray icon" })
  fireEvent.click(toggle)
  expect(await screen.findByRole("alert")).toBeTruthy()
  expect(toggle.getAttribute("aria-checked")).toBe("true")
  invoke.mockResolvedValueOnce({ tray_enabled: false })
  fireEvent.click(toggle)
  await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("false"))
  expect(screen.queryByRole("alert")).toBeNull()
})

it("shows a recoverable error when the desktop cannot supply its settings", async () => {
  invoke.mockRejectedValueOnce("Command desktop_settings not found")
  settings()
  expect(await screen.findByRole("alert")).toBeTruthy()
  expect(screen.queryByRole("switch")).toBeNull()
  invoke.mockResolvedValueOnce({ tray_enabled: true })
  fireEvent.click(screen.getByRole("button", { name: "Try again" }))
  expect(await screen.findByRole("switch", { name: "Enable tray icon" })).toBeTruthy()
})
