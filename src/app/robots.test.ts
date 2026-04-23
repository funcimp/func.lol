// src/app/robots.test.ts
import { describe, test, expect } from "bun:test"
import robots from "./robots"
import { PATTERNS, SAFE_EXACT_PATHS } from "@/lib/tripwire/patterns"

describe("robots.ts", () => {
  const output = robots()

  test("userAgent is '*'", () => {
    const rule = Array.isArray(output.rules) ? output.rules[0] : output.rules
    expect(rule.userAgent).toBe("*")
  })

  test("disallow contains every prefix-shape pattern", () => {
    const rule = Array.isArray(output.rules) ? output.rules[0] : output.rules
    const disallow = rule.disallow as string[]
    const prefixTokens = PATTERNS.filter((p) => p.shape === "prefix").map((p) => p.token)
    for (const token of prefixTokens) {
      expect(disallow).toContain(token)
    }
  })

  test("disallow does not contain substring tokens directly", () => {
    const rule = Array.isArray(output.rules) ? output.rules[0] : output.rules
    const disallow = rule.disallow as string[]
    const substringTokens = PATTERNS.filter((p) => p.shape === "substring").map((p) => p.token)
    for (const token of substringTokens) {
      expect(disallow).not.toContain(token)
    }
  })

  test("disallow does not contain safe exact paths", () => {
    const rule = Array.isArray(output.rules) ? output.rules[0] : output.rules
    const disallow = rule.disallow as string[]
    for (const safe of SAFE_EXACT_PATHS) {
      expect(disallow).not.toContain(safe)
    }
  })

  test("disallow is sorted and deduplicated", () => {
    const rule = Array.isArray(output.rules) ? output.rules[0] : output.rules
    const disallow = rule.disallow as string[]
    const sorted = [...disallow].sort()
    expect(disallow).toEqual(sorted)
    expect(new Set(disallow).size).toBe(disallow.length)
  })

  test("sitemap points to func.lol", () => {
    expect(output.sitemap).toBe("https://func.lol/sitemap.xml")
  })
})
