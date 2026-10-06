import { QueryClient, type InfiniteData } from "@tanstack/react-query"
import { describe, expect, it } from "vitest"

import type { ReleaseDetail, ReleasePage } from "@/lib/api/types"
import { makeListItem, makeRelease, makeRepository } from "@/test/fixtures"

import { removeFromList, setMutedEverywhere } from "./cache"
import { releaseKeys } from "./query-keys"

const APP = makeListItem({ id: 1, repository: makeRepository({ id: 10 }) })
const TOOL = makeListItem({ id: 2, repository: makeRepository({ id: 20, full_name: "acme/tool" }) })

function pages(...items: (typeof APP)[][]): InfiniteData<ReleasePage> {
  const total = items.flat().length
  return { pages: items.map((page) => ({ items: page, total })), pageParams: [0, 1] }
}

describe("removeFromList", () => {
  it("removes the entry from every list of the view only", () => {
    const client = new QueryClient()
    client.setQueryData(releaseKeys.list("inbox", ""), pages([APP], [TOOL]))
    client.setQueryData(releaseKeys.list("inbox", "acme"), pages([APP, TOOL]))
    client.setQueryData(releaseKeys.list("read", ""), pages([APP]))

    removeFromList(client, "inbox", 10)

    for (const search of ["", "acme"]) {
      const data = client.getQueryData<InfiniteData<ReleasePage>>(releaseKeys.list("inbox", search))
      expect(data?.pages.flatMap((page) => page.items)).toEqual([TOOL])
      expect(data?.pages.at(-1)?.total).toBe(1)
    }
    const read = client.getQueryData<InfiniteData<ReleasePage>>(releaseKeys.list("read", ""))
    expect(read?.pages[0]?.items).toEqual([APP])
  })
})

describe("setMutedEverywhere", () => {
  it("updates the repository in lists and details", () => {
    const client = new QueryClient()
    const detail: ReleaseDetail = { ...makeRelease({ id: 1 }), body: null }
    client.setQueryData(releaseKeys.list("inbox", ""), pages([APP, TOOL]))
    client.setQueryData(releaseKeys.detail(1), detail)

    setMutedEverywhere(client, 10, "2026-10-06T12:00:00Z")

    const list = client.getQueryData<InfiniteData<ReleasePage>>(releaseKeys.list("inbox", ""))
    const [app, tool] = list?.pages[0]?.items ?? []
    expect(app?.repository.notifications_muted_at).toBe("2026-10-06T12:00:00Z")
    expect(tool?.repository.notifications_muted_at).toBeNull()
    expect(
      client.getQueryData<ReleaseDetail>(releaseKeys.detail(1))?.repository.notifications_muted_at
    ).toBe("2026-10-06T12:00:00Z")
  })
})
