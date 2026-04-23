// src/proxy.test.ts
import { describe, test, expect, beforeEach, beforeAll } from "bun:test"
import { gzipSync } from "node:zlib"
import { writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs"
import path from "node:path"
import { NextRequest } from "next/server"

import { proxy } from "./proxy"
import { resetGuardForTests } from "@/lib/tripwire/observe"

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
  })

  test("non-bait URL returns undefined (pass-through)", async () => {
    const res = await proxy(req("/x/prime-moments"))
    expect(res).toBeUndefined()
  })

  test("bait URL rewrites to the internal bomb route per kind", async () => {
    // Cases map bait path to the expected bomb kind in the rewrite target.
    // The bomb response itself (Content-Encoding: gzip and Content-Type) is
    // produced by the route handler, tested separately at the E2E layer.
    // Proxy responses CANNOT set Content-Encoding — Next.js strips it.
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
})
