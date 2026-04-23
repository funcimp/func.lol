// src/lib/tripwire/observe.test.ts
import { describe, test, expect, beforeAll } from "bun:test"

beforeAll(() => {
  process.env.TRIPWIRE_IP_SALT = "test-salt-deterministic"
})

import { hashIP, uaFamily, guard, resetGuardForTests } from "./observe"

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

describe("uaFamily", () => {
  const cases: Array<[string, string]> = [
    ["Nuclei - Open-source project (github.com/projectdiscovery/nuclei)", "nuclei"],
    ["Mozilla/5.0 zgrab/0.x", "zgrab"],
    ["masscan/1.3", "masscan"],
    ["Mozilla/5.0 (compatible; Nmap Scripting Engine; https://nmap.org/book/nse.html)", "nmap"],
    ["gobuster/3.6", "gobuster"],
    ["Mozilla/5.0 ffuf/2.1", "ffuf"],
    ["python-requests/2.31.0", "requests"],
    ["Python-urllib/3.11", "python"],
    ["curl/8.4.0", "curl"],
    ["Wget/1.21.4", "wget"],
    ["Go-http-client/1.1", "go-http-client"],
    ["Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "googlebot"],
    ["Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)", "bingbot"],
    ["DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)", "duckduckbot"],
    ["", "unknown"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36", "unknown"],
  ]

  for (const [ua, expected] of cases) {
    test(`classifies ${JSON.stringify(ua.slice(0, 40))} as ${expected}`, () => {
      expect(uaFamily(ua)).toBe(expected)
    })
  }

  test("first-match-wins when a UA contains multiple tokens", () => {
    // A scanner pretending to be Googlebot still classifies as the scanner,
    // because 'nuclei' appears earlier in the UA_FAMILIES table than 'googlebot'.
    expect(uaFamily("Nuclei/2.8 (pretending to be Googlebot/2.1)")).toBe("nuclei")
  })
})

describe("guard", () => {
  test("first N calls with the same ipHash return true; (N+1)th returns false", () => {
    resetGuardForTests()
    const ip = "sha256:abc"
    for (let i = 0; i < 30; i++) {
      expect(guard(ip), `call ${i + 1}`).toBe(true)
    }
    expect(guard(ip)).toBe(false)
  })

  test("different IPs have independent counters", () => {
    resetGuardForTests()
    for (let i = 0; i < 30; i++) {
      guard("sha256:a")
    }
    expect(guard("sha256:a")).toBe(false)
    expect(guard("sha256:b")).toBe(true)
  })

  test("global limit stops further bombs regardless of IP variety", () => {
    resetGuardForTests()
    // 1000 total across varied IPs; the 1001st call (any IP) is false.
    let allowedCount = 0
    for (let i = 0; i < 1100; i++) {
      if (guard(`sha256:ip-${i}`)) allowedCount++
    }
    expect(allowedCount).toBe(1000)
  })

  test("window rollover: after 60s the counter resets", () => {
    resetGuardForTests()
    const ip = "sha256:rollover"
    const t0 = 1_000_000_000
    for (let i = 0; i < 30; i++) {
      expect(guard(ip, t0)).toBe(true)
    }
    expect(guard(ip, t0)).toBe(false)
    // Step past the 60s window:
    expect(guard(ip, t0 + 60_001)).toBe(true)
  })
})
