// src/lib/tripwire/aggregates.test.ts
import { describe, test, expect, beforeEach, mock } from "bun:test"
import * as blob from "@vercel/blob"
import type { Aggregates } from "@/lib/tripwire/aggregate-shape"

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

interface GetCall {
  pathname: string
  options: Record<string, unknown>
}
const getCalls: GetCall[] = []
type GetMode = "ok" | "bad-status"
let getMode: GetMode = "ok"

mock.module("@vercel/blob", () => ({
  ...blob,
  get: async (pathname: string, options: Record<string, unknown>) => {
    getCalls.push({ pathname, options })
    if (getMode === "bad-status") return { stream: null, statusCode: 404 }
    const text = JSON.stringify(SAMPLE)
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode(text))
        c.close()
      },
    })
    return { stream, statusCode: 200 }
  },
}))

const { getAggregates, _resetAggregatesCacheForTests } = await import("./aggregates")

beforeEach(() => {
  _resetAggregatesCacheForTests()
  getCalls.length = 0
  getMode = "ok"
})

describe("getAggregates", () => {
  test("cache miss fetches and parses the blob", async () => {
    const result = await getAggregates()
    expect(result).toEqual(SAMPLE)
    expect(getCalls).toHaveLength(1)
    expect(getCalls[0].pathname).toBe("stats/tripwire-aggregates.json")
    expect(getCalls[0].options).toMatchObject({ access: "private" })
  })

  test("cache hit within TTL skips the fetch", async () => {
    await getAggregates()
    expect(getCalls).toHaveLength(1)
    const result = await getAggregates()
    expect(result).toEqual(SAMPLE)
    expect(getCalls).toHaveLength(1)
  })

  test("expired TTL triggers a fresh fetch", async () => {
    const realNow = Date.now
    let now = 1_000_000
    Date.now = () => now
    try {
      await getAggregates()
      expect(getCalls).toHaveLength(1)
      now += 2 * 60 * 1000 + 1
      await getAggregates()
      expect(getCalls).toHaveLength(2)
    } finally {
      Date.now = realNow
    }
  })

  test("throws when get() returns a non-200 status", async () => {
    getMode = "bad-status"
    await expect(getAggregates()).rejects.toThrow(/status 404/)
  })
})
