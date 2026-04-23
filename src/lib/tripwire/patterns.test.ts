// src/lib/tripwire/patterns.test.ts
import { describe, test, expect } from "bun:test"
import { matchBait, PATTERNS, SAFE_PREFIXES, SAFE_EXACT_PATHS } from "./patterns"

function url(path: string): URL {
  return new URL(path, "https://func.lol")
}

describe("matchBait", () => {
  test("returns null for root", () => {
    expect(matchBait(url("/"))).toBeNull()
  })

  test("returns null for an experiment route", () => {
    expect(matchBait(url("/x/prime-moments"))).toBeNull()
  })

  test("returns null for Next.js internals", () => {
    expect(matchBait(url("/_next/static/chunks/main.js"))).toBeNull()
  })

  test("returns null for API routes", () => {
    expect(matchBait(url("/api/webhook"))).toBeNull()
  })

  test("returns null for well-known paths", () => {
    expect(matchBait(url("/.well-known/acme-challenge/abc"))).toBeNull()
  })

  test("returns null for /favicon.ico", () => {
    expect(matchBait(url("/favicon.ico"))).toBeNull()
  })

  test("returns null for /robots.txt", () => {
    expect(matchBait(url("/robots.txt"))).toBeNull()
  })

  test("returns null for exact safe path /admin", () => {
    expect(matchBait(url("/admin"))).toBeNull()
  })

  test("safe-exact is NOT honored when a query string is present", () => {
    // pathname "/" is in SAFE_EXACT_PATHS, but a scanner probe like
    // /?q=user/password (Drupageddon) shares that pathname. The query
    // should flip the decision to pattern matching.
    const m = matchBait(url("/?q=user/password"))
    expect(m).not.toBeNull()
  })

  const baitCases: Array<[string, string]> = [
    ["/wp-login.php",                            "cms"],
    ["/wp-admin/",                               "cms"],
    ["/xmlrpc.php",                              "cms"],
    ["/phpunit/src/Util/PHP/eval-stdin.php",     "framework"],
    ["/lib/phpunit/phpunit/src/Util/PHP/eval-stdin.php", "framework"],
    ["/.env",                                    "config"],
    ["/.env.production",                         "config"],
    ["/.git/config",                             "config"],
    ["/phpmyadmin/",                             "admin"],
    ["/phpMyAdmin/",                             "admin"],
    ["/actuator/env",                            "actuator"],
    ["/cgi-bin/",                                "cgi"],
    ["/shell.php",                               "webshell"],
    ["/latest/meta-data/",                       "metadata"],
    ["/anything?target=169.254.169.254/latest",  "metadata"],
  ]

  for (const [path, expectedCategory] of baitCases) {
    test(`matches bait ${path} as ${expectedCategory}`, () => {
      const m = matchBait(url(path))
      expect(m).not.toBeNull()
      expect(m!.category).toBe(expectedCategory)
    })
  }

  const slashlessBaitCases: Array<[string, string]> = [
    ["/phpmyadmin",                              "admin"],
    ["/wp-admin",                                "cms"],
    ["/cgi-bin",                                 "cgi"],
    ["/actuator",                                "actuator"],
  ]

  for (const [path, expectedCategory] of slashlessBaitCases) {
    test(`matches directory-style bait without trailing slash: ${path} as ${expectedCategory}`, () => {
      const m = matchBait(url(path))
      expect(m, path).not.toBeNull()
      expect(m!.category).toBe(expectedCategory)
    })
  }

  test("slashless bait with query string still matches", () => {
    const m = matchBait(url("/phpmyadmin?target=root"))
    expect(m).not.toBeNull()
    expect(m!.category).toBe("admin")
  })

  test("slashless form does NOT match if followed by more path characters", () => {
    // /phpmyadminbackup should NOT match /phpmyadmin/ pattern — different path.
    // (No such pattern exists, but verifying the guard protects against
    // false positives like /wp-adminish matching /wp-admin/.)
    expect(matchBait(url("/phpmyadminbackup"))).toBeNull()
  })

  test("case-insensitive", () => {
    expect(matchBait(url("/WP-LOGIN.PHP"))?.category).toBe("cms")
    expect(matchBait(url("/PhpMyAdmin/"))?.category).toBe("admin")
  })

  test("query-string matching: ThinkPHP invokefunction", () => {
    const m = matchBait(url("/index.php?s=/Index/\\think\\app/invokefunction"))
    expect(m).not.toBeNull()
    expect(m!.category).toBe("framework")
  })

  test("query-string matching: Drupageddon /?q=user/password", () => {
    const m = matchBait(url("/?q=user/password"))
    expect(m).not.toBeNull()
    expect(m!.category).toBe("cms")
  })

  test("UA is irrelevant (no UA allowlist in v1)", () => {
    // matchBait takes only URL. Anything with Googlebot UA hitting /wp-admin/
    // still returns a pattern. The proxy is responsible for UA handling
    // (there is none at v1), not matchBait.
    expect(matchBait(url("/wp-admin/"))).not.toBeNull()
  })
})

describe("pattern integrity", () => {
  test("no PATTERNS entry matches a path under a SAFE_PREFIX", () => {
    for (const prefix of SAFE_PREFIXES) {
      const testPath = prefix.endsWith("/") ? prefix + "something" : prefix
      const result = matchBait(url(testPath))
      expect(result, `${testPath} should not match any pattern`).toBeNull()
    }
  })

  test("no PATTERNS entry matches a SAFE_EXACT path", () => {
    for (const exact of SAFE_EXACT_PATHS) {
      expect(matchBait(url(exact)), `${exact} should not match`).toBeNull()
    }
  })

  test("every pattern has a non-empty token", () => {
    for (const p of PATTERNS) {
      expect(p.token.length, `pattern token empty`).toBeGreaterThan(0)
    }
  })
})
