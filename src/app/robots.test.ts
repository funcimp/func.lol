// src/app/robots.test.ts
import { describe, test, expect } from "bun:test"
import robots from "./robots"
import { PATTERNS, SAFE_EXACT_PATHS } from "@/lib/tripwire/patterns"

describe("robots.ts", () => {
  const output = robots()
  const rule = Array.isArray(output.rules) ? output.rules[0] : output.rules
  const disallow = rule.disallow as string[]

  test("userAgent is '*'", () => {
    expect(rule.userAgent).toBe("*")
  })

  test("disallow contains every prefix-shape pattern", () => {
    const prefixTokens = PATTERNS.filter((p) => p.shape === "prefix").map((p) => p.token)
    for (const token of prefixTokens) {
      expect(disallow).toContain(token)
    }
  })

  test("disallow does not contain substring-only tokens", () => {
    // Tokens that exist as both a prefix and a substring (e.g. /.env) are
    // expected to appear in disallow because of the prefix entry; only
    // substring-ONLY tokens should be excluded from robots.txt.
    const prefixTokens = new Set(
      PATTERNS.filter((p) => p.shape === "prefix").map((p) => p.token),
    )
    const substringOnlyTokens = PATTERNS
      .filter((p) => p.shape === "substring" && !prefixTokens.has(p.token))
      .map((p) => p.token)
    for (const token of substringOnlyTokens) {
      expect(disallow).not.toContain(token)
    }
  })

  test("disallow does not contain safe exact paths", () => {
    for (const safe of SAFE_EXACT_PATHS) {
      expect(disallow).not.toContain(safe)
    }
  })

  test("disallow is sorted and deduplicated", () => {
    const sorted = [...disallow].sort()
    expect(disallow).toEqual(sorted)
    expect(new Set(disallow).size).toBe(disallow.length)
  })

  test("sitemap points to func.lol", () => {
    expect(output.sitemap).toBe("https://func.lol/sitemap.xml")
  })
})
