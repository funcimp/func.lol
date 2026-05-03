// src/lib/tripwire/ingest.test.ts
import { describe, test, expect } from "bun:test"
import { recentDatePrefixes } from "./ingest"

describe("recentDatePrefixes", () => {
  test("returns today and yesterday in UTC, today first", () => {
    const now = new Date("2026-05-03T12:34:56.000Z")
    expect(recentDatePrefixes(now)).toEqual([
      "events/2026-05-03/",
      "events/2026-05-02/",
    ])
  })

  test("crosses month boundary correctly", () => {
    const now = new Date("2026-06-01T00:30:00.000Z")
    expect(recentDatePrefixes(now)).toEqual([
      "events/2026-06-01/",
      "events/2026-05-31/",
    ])
  })

  test("uses UTC, not local time, just before midnight UTC", () => {
    // Late on the 3rd UTC -> today=03, yesterday=02 regardless of host TZ.
    const now = new Date("2026-05-03T23:59:59.000Z")
    expect(recentDatePrefixes(now)).toEqual([
      "events/2026-05-03/",
      "events/2026-05-02/",
    ])
  })
})
