// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { HiddenNotice } from "./hidden-notice"

const RULE = { id: 1, pattern: "web@*", match_count: 12 }

function renderNotice(props: Partial<ComponentProps<typeof HiddenNotice>>) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <HiddenNotice
        repositoryId={10}
        rules={[]}
        hiddenAsPrerelease={false}
        onOpenSettings={vi.fn()}
        {...props}
      />
    </QueryClientProvider>
  )
}

describe("HiddenNotice", () => {
  afterEach(cleanup)

  it("names the rule and offers to show its releases again", () => {
    renderNotice({ rules: [RULE] })

    expect(screen.getByText(/Hidden by the rule/).textContent).toContain("web@*")
    expect(screen.getByText("It hides 12 releases")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Show again" })).toBeTruthy()
  })

  it("points to the settings when pre-releases are hidden, even if a rule matches too", () => {
    renderNotice({ rules: [RULE], hiddenAsPrerelease: true })

    expect(screen.getByText("Hidden because pre-releases are hidden")).toBeTruthy()
    expect(screen.getByText(/Also hidden by the rule/)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Change" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Show again" })).toBeNull()
  })
})
