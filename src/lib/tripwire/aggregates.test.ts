// src/lib/tripwire/aggregates.test.ts
import { describe, test, expect, beforeEach, mock } from "bun:test"
import * as blob from "@vercel/blob"
import { STATS_BLOB_TAG, type Aggregates } from "@/lib/tripwire/aggregate-shape"

const SAMPLE: Aggregates = {
  generatedAt: "2026-05-02T00:00:00.000Z",
  lifetime: {
    totalEvents: 7,
    earliestTs: "2026-04-24T00:00:00.000Z",
    latestTs: "2026-05-02T00:00:00.000Z",
    daysSinceFirst: 9,
    distinctIps: 3,
    distinctPaths: 5,
    distinctAsns: 2,
  },
  byCategory: [],
  byUaFamily: [],
  byDay: [],
  topPaths: [],
  byAsn: [],
}

const FAKE_URL = "https://store.private.blob.vercel-storage.com/stats/tripwire-aggregates.json"

interface HeadCall { pathname: string }
interface FetchCall { url: string; init: RequestInit | undefined }

const headCalls: HeadCall[] = []
const fetchCalls: FetchCall[] = []
type FetchMode = "ok" | "bad-status"
let fetchMode: FetchMode = "ok"

mock.module("@vercel/blob", () => ({
  ...blob,
  head: async (pathname: string) => {
    headCalls.push({ pathname })
    return { url: FAKE_URL, pathname }
  },
}))

const realFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  fetchCalls.push({ url: String(input), init })
  if (fetchMode === "bad-status") {
    return new Response("nope", { status: 404, statusText: "Not Found" })
  }
  return new Response(JSON.stringify(SAMPLE), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}) as typeof fetch

process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_test_token"

const { getAggregates, _resetAggregatesCacheForTests } = await import("./aggregates")

beforeEach(() => {
  _resetAggregatesCacheForTests()
  headCalls.length = 0
  fetchCalls.length = 0
  fetchMode = "ok"
})

describe("getAggregates", () => {
  test("cache miss fetches and parses the blob", async () => {
    const result = await getAggregates()
    expect(result).toEqual(SAMPLE)
    expect(headCalls).toHaveLength(1)
    expect(headCalls[0].pathname).toBe("stats/tripwire-aggregates.json")
    expect(fetchCalls).toHaveLength(1)
    expect(fetchCalls[0].url).toBe(FAKE_URL)
    const headers = new Headers(fetchCalls[0].init?.headers)
    expect(headers.get("authorization")).toBe("Bearer vercel_blob_rw_test_token")
    const next = (fetchCalls[0].init as { next?: { tags?: string[] } } | undefined)?.next
    expect(next?.tags).toEqual([STATS_BLOB_TAG])
  })

  test("cache hit within TTL skips the fetch", async () => {
    await getAggregates()
    expect(fetchCalls).toHaveLength(1)
    const result = await getAggregates()
    expect(result).toEqual(SAMPLE)
    expect(fetchCalls).toHaveLength(1)
  })

  test("expired TTL triggers a fresh fetch", async () => {
    const realNow = Date.now
    let now = 1_000_000
    Date.now = () => now
    try {
      await getAggregates()
      expect(fetchCalls).toHaveLength(1)
      now += 2 * 60 * 1000 + 1
      await getAggregates()
      expect(fetchCalls).toHaveLength(2)
    } finally {
      Date.now = realNow
    }
  })

  test("throws when fetch returns a non-200 status", async () => {
    fetchMode = "bad-status"
    await expect(getAggregates()).rejects.toThrow(/status 404/)
  })
})

// Restore real fetch so other test files aren't affected.
process.on("beforeExit", () => {
  globalThis.fetch = realFetch
})
