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

  test("empty string and a real IP produce different hashes", () => {
    expect(hashIP("")).not.toBe(hashIP("0.0.0.0"))
  })

  test("hash is prefixed with algorithm and truncated to 16 hex chars", () => {
    expect(hashIP("1.2.3.4")).toMatch(/^sha256:[0-9a-f]{16}$/)
  })

  test("salt changes the hash (prevents precomputation)", () => {
    const withA = hashIP("1.2.3.4")
    process.env.TRIPWIRE_IP_SALT = "different-salt"
    const withB = hashIP("1.2.3.4")
    process.env.TRIPWIRE_IP_SALT = "test-salt-deterministic"
    expect(withA).not.toBe(withB)
  })

  test("throws when salt missing and NODE_ENV is production", () => {
    const savedSalt = process.env.TRIPWIRE_IP_SALT
    const savedEnv = process.env.NODE_ENV
    delete process.env.TRIPWIRE_IP_SALT
    process.env.NODE_ENV = "production"
    try {
      expect(() => hashIP("1.2.3.4")).toThrow(/TRIPWIRE_IP_SALT/)
    } finally {
      if (savedSalt !== undefined) process.env.TRIPWIRE_IP_SALT = savedSalt
      if (savedEnv !== undefined) process.env.NODE_ENV = savedEnv
    }
  })
})
