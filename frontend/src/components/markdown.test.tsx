// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"

import { Markdown } from "./markdown"

afterEach(cleanup)

it("resolves anchors within their own release when headings repeat in What's new", () => {
  const baseUrls = { links: "https://github.com/acme/app/", images: "https://github.com/acme/app/" }
  render(
    <>
      <Markdown content={"[First changes](#changes)\n\n## Changes"} baseUrls={baseUrls} />
      <Markdown content={"[Second changes](#changes)\n\n## Changes"} baseUrls={baseUrls} />
    </>
  )
  const [first, second] = screen.getAllByRole("heading", { name: "Changes" })
  const firstScroll = vi.fn()
  const secondScroll = vi.fn()
  first!.scrollIntoView = firstScroll
  second!.scrollIntoView = secondScroll
  fireEvent.click(screen.getByRole("link", { name: "Second changes" }))
  expect(secondScroll).toHaveBeenCalled()
  expect(firstScroll).not.toHaveBeenCalled()
})

it("keeps footnote links and backlinks within their own document", () => {
  const baseUrls = { links: "https://github.com/acme/app/", images: "https://github.com/acme/app/" }
  const content = "A note[^1].\n\n[^1]: Footnote text."
  const { container } = render(
    <>
      <Markdown content={content} baseUrls={baseUrls} />
      <Markdown content={content} baseUrls={baseUrls} />
    </>
  )
  const scroll = vi.fn()
  const second = container.children[1]!
  second.querySelector("li")!.scrollIntoView = scroll
  fireEvent.click(second.querySelector("a[data-footnote-ref]")!)
  expect(scroll).toHaveBeenCalledOnce()
  const back = vi.fn()
  second.querySelector("a[data-footnote-ref]")!.scrollIntoView = back
  fireEvent.click(second.querySelector("a[data-footnote-backref]")!)
  expect(back).toHaveBeenCalledOnce()
})
