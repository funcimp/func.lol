// src/lib/tripwire/observe.test.ts
import { describe, test, expect } from "bun:test"
import { uaFamily, guard, resetGuardForTests } from "./observe"

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
  test("first N calls with the same IP return true; (N+1)th returns false", () => {
    resetGuardForTests()
    const ip = "1.2.3.4"
    for (let i = 0; i < 30; i++) {
      expect(guard(ip), `call ${i + 1}`).toBe(true)
    }
    expect(guard(ip)).toBe(false)
  })

  test("different IPs have independent counters", () => {
    resetGuardForTests()
    for (let i = 0; i < 30; i++) {
      guard("1.1.1.1")
    }
    expect(guard("1.1.1.1")).toBe(false)
    expect(guard("2.2.2.2")).toBe(true)
  })

  test("global limit stops further bombs regardless of IP variety", () => {
    resetGuardForTests()
    // 1000 total across varied IPs; the 1001st call (any IP) is false.
    let allowedCount = 0
    for (let i = 0; i < 1100; i++) {
      if (guard(`10.0.${Math.floor(i / 256)}.${i % 256}`)) allowedCount++
    }
    expect(allowedCount).toBe(1000)
  })

  test("window rollover: after 60s the counter resets", () => {
    resetGuardForTests()
    const ip = "9.9.9.9"
    const t0 = 1_000_000_000
    for (let i = 0; i < 30; i++) {
      expect(guard(ip, t0)).toBe(true)
    }
    expect(guard(ip, t0)).toBe(false)
    // Step past the 60s window:
    expect(guard(ip, t0 + 60_001)).toBe(true)
  })
})
