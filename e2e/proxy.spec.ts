import { test, expect } from "@playwright/test"

// E2E verification that the tripwire proxy is detected by Next.js and serves
// MIME-contextual gzip bombs on bait paths. Relies on TRIPWIRE_FORCE=1 set in
// playwright.config.ts so the proxy runs under `next dev`.
//
// These tests assert HEADERS only. They never read the response body — real
// bombs decompress to multiple GB and would crash the test runner. The body
// assertion is covered by the unit tests in src/proxy.test.ts against
// small-bomb fixtures.

test.describe("tripwire proxy", () => {
  test("non-bait page passes through", async ({ request }) => {
    const res = await request.get("/x/tripwire")
    expect(res.status()).toBe(200)
    // Normal page, no gzip Content-Encoding header set by proxy.
    expect(res.headers()["content-encoding"]).not.toBe("gzip")
  })

  test("non-existent non-bait path returns 404", async ({ request }) => {
    const res = await request.get("/hello-world")
    expect(res.status()).toBe(404)
  })

  test.describe("bait paths serve the right bomb", () => {
    const cases: Array<[string, string]> = [
      ["/wp-login.php",         "text/html; charset=utf-8"],
      ["/shell.php",            "text/html; charset=utf-8"],
      ["/phpmyadmin/",          "text/html; charset=utf-8"],
      ["/phpmyadmin",           "text/html; charset=utf-8"],
      ["/actuator/env",         "application/json; charset=utf-8"],
      ["/.env",                 "text/plain; charset=utf-8"],
      ["/config.yaml",          "application/yaml; charset=utf-8"],
      ["/config.json",          "application/json; charset=utf-8"],
      ["/docker-compose.yml",   "application/yaml; charset=utf-8"],
    ]

    for (const [pathname, expectedType] of cases) {
      test(`${pathname} returns gzip ${expectedType}`, async ({ request }) => {
        // Disable auto-decompression so we see the raw gzip bytes and the
        // Content-Encoding header as served.
        const res = await request.get(pathname, {
          headers: { "accept-encoding": "identity" },
          maxRedirects: 0,
        })
        expect(res.status(), pathname).toBe(200)
        expect(res.headers()["content-encoding"], pathname).toBe("gzip")
        expect(res.headers()["content-type"], pathname).toBe(expectedType)
        expect(res.headers()["cache-control"], pathname).toBe("no-store")
      })
    }
  })

  test("POST to a bait path still bombs", async ({ request }) => {
    // Scanners POST to /xmlrpc.php for WordPress attacks; they probe with
    // every verb. Our bomb route must accept all methods.
    const res = await request.post("/xmlrpc.php", {
      headers: { "accept-encoding": "identity" },
      maxRedirects: 0,
    })
    expect(res.status()).toBe(200)
    expect(res.headers()["content-encoding"]).toBe("gzip")
    expect(res.headers()["content-type"]).toBe("text/html; charset=utf-8")
  })

  test("PUT to a bait path still bombs", async ({ request }) => {
    const res = await request.put("/actuator/env", {
      headers: { "accept-encoding": "identity" },
      maxRedirects: 0,
    })
    expect(res.status()).toBe(200)
    expect(res.headers()["content-type"]).toBe("application/json; charset=utf-8")
  })

  test("robots.txt lists bait paths as Disallow", async ({ request }) => {
    const res = await request.get("/robots.txt")
    expect(res.status()).toBe(200)
    const body = await res.text()
    expect(body).toContain("Disallow: /wp-login.php")
    expect(body).toContain("Disallow: /.env")
    expect(body).toContain("Disallow: /phpmyadmin/")
  })
})
