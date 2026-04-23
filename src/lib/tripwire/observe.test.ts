// src/lib/tripwire/observe.test.ts
import { describe, test, expect, beforeAll } from "bun:test"

beforeAll(() => {
  process.env.TRIPWIRE_IP_SALT = "test-salt-deterministic"
})

import { hashIP, uaFamily, guard } from "./observe"

describe("hashIP", () => {
  test("returns a stable hash for a given IP", () => {
    const a = hashIP("1.2.3.4")
    const b = hashIP("1.2.3.4")
    expect(a).toBe(b)
  })

  test("different IPs produce different hashes", () => {
    expect(hashIP("1.2.3.4")).not.toBe(hashIP("5.6.7.8"))
  })

  test("empty string produces a stable hash", () => {
    expect(hashIP("")).toBe(hashIP(""))
    expect(hashIP("")).toMatch(/^sha256:[0-9a-f]{16}$/)
  })

  test("hash is prefixed with algorithm and truncated to 16 hex chars", () => {
    expect(hashIP("1.2.3.4")).toMatch(/^sha256:[0-9a-f]{16}$/)
  })
})
