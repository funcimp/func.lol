// src/proxy.test.ts
import { describe, test, expect, beforeEach, beforeAll, mock } from "bun:test"
import { gzipSync } from "node:zlib"
import { writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs"
import path from "node:path"
import * as nextServer from "next/server"

const { NextRequest } = nextServer

// after() from next/server requires a real Next.js request context that
// bun:test doesn't provide; calling it would throw. The put() promise is
// constructed eagerly so its mock captures the call before after() runs;
// no-op'ing after() lets us assert on putCalls without losing fidelity.
mock.module("next/server", () => ({
  ...nextServer,
  after: () => {},
}))

// Capture blob put() calls instead of hitting Blob storage.
interface PutCall {
  pathname: string
  body: string
  options: Record<string, unknown>
}
const putCalls: PutCall[] = []

mock.module("@vercel/blob", () => ({
  put: async (pathname: string, body: string, options: Record<string, unknown>) => {
    putCalls.push({ pathname, body, options })
    return { url: `https://blob.example/${pathname}`, pathname }
  },
}))

const { proxy } = await import("./proxy")
const { resetGuardForTests } = await import("@/lib/tripwire/observe")

function req(pathname: string, init?: { ua?: string; ip?: string }): NextRequest {
  const url = new URL(pathname, "https://func.lol")
  const headers = new Headers()
  if (init?.ua) headers.set("user-agent", init.ua)
  if (init?.ip) headers.set("x-forwarded-for", init.ip)
  return new NextRequest(url, { headers })
}

// Put small bombs on disk so the proxy can stream them from public/.
// These OVERWRITE the prod bombs produced by `bun run scripts/build-bombs.ts`.
// Remove the build-bombs cache so a subsequent `bun run build` regenerates
// real bombs rather than trusting the stale hash against the tiny outputs.
beforeAll(async () => {
  const dir = path.join(process.cwd(), "public")
  mkdirSync(dir, { recursive: true })

  const htmlBody = Buffer.from("<!DOCTYPE html><html><body><p>tiny</p></body></html>")
  const jsonBody = Buffer.from('{"error":"not_found","note":"tiny"}')
  const yamlBody = Buffer.from("warning: |-\n  tiny\n")
  const envBody = Buffer.from("DB_PASSWORD=tiny\n")

  writeFileSync(path.join(dir, ".bomb.html.gz"), gzipSync(htmlBody, { level: 9 }))
  writeFileSync(path.join(dir, ".bomb.json.gz"), gzipSync(jsonBody, { level: 9 }))
  writeFileSync(path.join(dir, ".bomb.yaml.gz"), gzipSync(yamlBody, { level: 9 }))
  writeFileSync(path.join(dir, ".bomb.env.gz"), gzipSync(envBody, { level: 9 }))

  const cachePath = path.join(dir, ".bomb-cache.txt")
  if (existsSync(cachePath)) rmSync(cachePath)
})

describe("proxy", () => {
  beforeEach(() => {
    resetGuardForTests()
    process.env.NODE_ENV = "production"
    putCalls.length = 0
  })

  test("non-bait URL returns undefined (pass-through)", async () => {
    const res = await proxy(req("/x/prime-moments"))
    expect(res).toBeUndefined()
    expect(putCalls).toHaveLength(0)
  })

  test("bait URL rewrites to the internal bomb route per kind", async () => {
    const cases: Array<[string, "html" | "json" | "yaml" | "env"]> = [
      ["/wp-admin/",            "html"],
      ["/actuator/env",         "json"],
      ["/.env",                 "env"],
      ["/config.yaml",          "yaml"],
      ["/config.json",          "json"],
      ["/docker-compose.yml",   "yaml"],
    ]

    for (const [url, expectedKind] of cases) {
      resetGuardForTests()
      const res = (await proxy(req(url))) as Response
      expect(res, url).toBeInstanceOf(Response)
      expect(res.headers.get("x-middleware-rewrite"), url).toContain(
        `/api/tripwire/bomb/${expectedKind}`,
      )
    }
  })

  test("non-production NODE_ENV returns undefined even on bait URL", async () => {
    process.env.NODE_ENV = "development"
    const res = await proxy(req("/wp-admin/"))
    expect(res).toBeUndefined()
    expect(putCalls).toHaveLength(0)
  })

  test("circuit breaker trips after 30 hits from the same IP", async () => {
    resetGuardForTests()
    for (let i = 0; i < 30; i++) {
      const res = (await proxy(req("/wp-admin/", { ip: "1.2.3.4" }))) as Response
      expect(res?.status).toBe(200)
    }
    const throttled = await proxy(req("/wp-admin/", { ip: "1.2.3.4" }))
    expect(throttled).toBeUndefined()
  })

  describe("blob archive", () => {
    const FILENAME_RE = /^tripwire\/events\/\d{4}-\d{2}-\d{2}\/\d+-[0-9a-f]{6}\.json$/

    test("tripwire.hit fires-and-forgets one blob put with the event payload", async () => {
      const res = (await proxy(req("/wp-login.php", { ua: "Nuclei/2.9", ip: "9.9.9.9" }))) as Response
      expect(res).toBeInstanceOf(Response)
      expect(putCalls).toHaveLength(1)

      const { pathname, body, options } = putCalls[0]
      expect(pathname).toMatch(FILENAME_RE)
      expect(options).toMatchObject({
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
      })

      const event = JSON.parse(body) as Record<string, unknown>
      expect(event.event).toBe("tripwire.hit")
      expect(event.path).toBe("/wp-login.php")
      expect(event.pattern).toBe("/wp-login.php")
      expect(event.category).toBe("cms")
      expect(event.bomb).toBe("html")
      expect(event.ip).toBe("9.9.9.9")
      expect(event.ua_family).toBe("nuclei")
      expect(typeof event.ts).toBe("string")
    })

    test("tripwire.throttled fires-and-forgets one blob put with the smaller payload", async () => {
      resetGuardForTests()
      // Burn the per-IP allowance so the 31st request throttles.
      for (let i = 0; i < 30; i++) {
        await proxy(req("/wp-admin/", { ip: "5.5.5.5" }))
      }
      putCalls.length = 0

      const res = await proxy(req("/wp-admin/", { ip: "5.5.5.5" }))
      expect(res).toBeUndefined()
      expect(putCalls).toHaveLength(1)

      const event = JSON.parse(putCalls[0].body) as Record<string, unknown>
      expect(event.event).toBe("tripwire.throttled")
      expect(event.path).toBe("/wp-admin/")
      expect(event.pattern).toBe("/wp-admin/")
      expect(event.ip).toBe("5.5.5.5")
      // Throttled payload is intentionally minimal — no UA, category, or bomb.
      expect(event.ua_family).toBeUndefined()
      expect(event.category).toBeUndefined()
      expect(event.bomb).toBeUndefined()
    })

    test("blob put failure is caught, doesn't break the bomb response", async () => {
      // Re-mock to throw on this test only.
      mock.module("@vercel/blob", () => ({
        put: async () => {
          throw new Error("simulated blob outage")
        },
      }))
      // Re-import proxy so the new mock takes effect.
      const { proxy: proxyWithFailingBlob } = await import("./proxy")

      const res = (await proxyWithFailingBlob(
        req("/wp-login.php", { ip: "8.8.8.8" }),
      )) as Response
      // Bomb response still ships even though the archive write failed.
      expect(res).toBeInstanceOf(Response)
      expect(res.headers.get("x-middleware-rewrite")).toContain("/api/tripwire/bomb/html")

      // Restore the capturing mock for subsequent tests.
      mock.module("@vercel/blob", () => ({
        put: async (pathname: string, body: string, options: Record<string, unknown>) => {
          putCalls.push({ pathname, body, options })
          return { url: `https://blob.example/${pathname}`, pathname }
        },
      }))
    })
  })
})
