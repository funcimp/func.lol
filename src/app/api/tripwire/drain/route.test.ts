// src/app/api/tripwire/drain/route.test.ts
import { describe, test, expect, beforeEach, mock } from "bun:test"
import { createHmac, randomBytes } from "node:crypto"
import { gunzipSync } from "node:zlib"
import { NextRequest } from "next/server"

// Capture every put() call so we can assert on filenames + bodies without
// hitting Blob storage.
interface PutCall {
  pathname: string
  body: Buffer
  options: Record<string, unknown>
}
const putCalls: PutCall[] = []

mock.module("@vercel/blob", () => ({
  put: async (pathname: string, body: Uint8Array, options: Record<string, unknown>) => {
    putCalls.push({ pathname, body: Buffer.from(body), options })
    return { url: `https://blob.example/${pathname}`, pathname }
  },
}))

const { POST, bucketRecords } = await import("./route")

const SECRET = "test-drain-secret"

function sign(body: string): string {
  return createHmac("sha1", SECRET).update(body).digest("hex")
}

function drainReq(body: string, opts?: { signature?: string | null }): NextRequest {
  const headers = new Headers()
  const sig = opts?.signature === undefined ? sign(body) : opts.signature
  if (sig !== null) headers.set("x-vercel-signature", sig)
  return new NextRequest(new URL("https://func.lol/api/tripwire/drain"), {
    method: "POST",
    headers,
    body,
  })
}

function tripwireHitMessage(): string {
  return JSON.stringify({
    event: "tripwire.hit",
    ts: "2026-04-25T12:00:00.000Z",
    path: "/wp-login.php",
    pattern: "/wp-login.php",
    ip: "9.9.9.9",
    category: "cms",
    bomb: "html",
    ua_family: "nuclei",
    ua_raw: "Nuclei/1.0",
  })
}

beforeEach(() => {
  putCalls.length = 0
  process.env.TRIPWIRE_DRAIN_SECRET = SECRET
})

describe("drain handler", () => {
  test("missing TRIPWIRE_DRAIN_SECRET returns 500", async () => {
    delete process.env.TRIPWIRE_DRAIN_SECRET
    const res = await POST(drainReq("", { signature: "irrelevant" }))
    expect(res.status).toBe(500)
  })

  test("missing signature header returns 403", async () => {
    const res = await POST(drainReq("anything", { signature: null }))
    expect(res.status).toBe(403)
    expect(putCalls).toHaveLength(0)
  })

  test("wrong signature returns 403", async () => {
    const res = await POST(drainReq("anything", { signature: "deadbeef" }))
    expect(res.status).toBe(403)
    expect(putCalls).toHaveLength(0)
  })

  test("non-hex signature returns 403", async () => {
    const res = await POST(drainReq("anything", { signature: "not-hex-at-all" }))
    expect(res.status).toBe(403)
  })

  test("empty body, valid signature, returns 200 with zero counts", async () => {
    const res = await POST(drainReq(""))
    expect(res.status).toBe(200)
    const json = await res.json() as { ok: boolean; events: number; candidates: number }
    expect(json.ok).toBe(true)
    expect(json.events).toBe(0)
    expect(json.candidates).toBe(0)
    expect(putCalls).toHaveLength(0)
  })

  test("mixed batch: 1 tripwire event, 1 4xx, 1 2xx, 1 unrelated stdout → 1 event + 1 candidate", async () => {
    const lines = [
      // stdout from the proxy → should bucket as event
      JSON.stringify({
        source: "lambda",
        timestamp: 1714056000000,
        level: "info",
        type: "stdout",
        message: tripwireHitMessage(),
      }),
      // request log 404 on a non-bait path → should bucket as candidate
      JSON.stringify({
        source: "lambda",
        timestamp: 1714056001000,
        level: "info",
        proxy: {
          timestamp: 1714056001000,
          method: "GET",
          path: "/some-random-404",
          userAgent: ["Mozilla/5.0 nuclei/2.9"],
          statusCode: 404,
          clientIp: "1.2.3.4",
        },
      }),
      // request log 200 → dropped
      JSON.stringify({
        source: "lambda",
        timestamp: 1714056002000,
        proxy: {
          path: "/x/prime-moments",
          userAgent: ["Mozilla/5.0"],
          statusCode: 200,
          clientIp: "5.6.7.8",
        },
      }),
      // unrelated stdout → dropped
      JSON.stringify({
        source: "build",
        timestamp: 1714056003000,
        level: "info",
        message: "compiled successfully",
      }),
    ].join("\n")

    const res = await POST(drainReq(lines))
    expect(res.status).toBe(200)
    const json = await res.json() as {
      events: number
      candidates: number
      files: { events: string | null; candidates: string | null }
    }
    expect(json.events).toBe(1)
    expect(json.candidates).toBe(1)
    expect(json.files.events).not.toBeNull()
    expect(json.files.candidates).not.toBeNull()
    expect(putCalls).toHaveLength(2)

    const eventsCall = putCalls.find((c) => c.pathname.startsWith("tripwire/events/"))
    const candidatesCall = putCalls.find((c) => c.pathname.startsWith("tripwire/candidates/"))
    expect(eventsCall).toBeDefined()
    expect(candidatesCall).toBeDefined()

    const eventsBody = gunzipSync(eventsCall!.body).toString("utf8").trim().split("\n")
    expect(eventsBody).toHaveLength(1)
    const event = JSON.parse(eventsBody[0]) as { event: string; pattern: string }
    expect(event.event).toBe("tripwire.hit")
    expect(event.pattern).toBe("/wp-login.php")

    const candBody = gunzipSync(candidatesCall!.body).toString("utf8").trim().split("\n")
    expect(candBody).toHaveLength(1)
    const cand = JSON.parse(candBody[0]) as {
      event: string
      path: string
      status: number
      ua_family: string
      ip: string
    }
    expect(cand.event).toBe("candidate.4xx")
    expect(cand.path).toBe("/some-random-404")
    expect(cand.status).toBe(404)
    expect(cand.ua_family).toBe("nuclei")
    expect(cand.ip).toBe("1.2.3.4")
  })

  test("4xx on bait path is dropped (defensive)", async () => {
    const line = JSON.stringify({
      source: "lambda",
      timestamp: 1714056000000,
      proxy: {
        path: "/wp-login.php",
        userAgent: ["curl/8"],
        statusCode: 404,
        clientIp: "1.2.3.4",
      },
    })
    const res = await POST(drainReq(line))
    const json = await res.json() as { events: number; candidates: number }
    expect(json.events).toBe(0)
    expect(json.candidates).toBe(0)
    expect(putCalls).toHaveLength(0)
  })

  test("5xx is dropped (only 4xx are candidates)", async () => {
    const line = JSON.stringify({
      proxy: { path: "/api/something", statusCode: 500, clientIp: "x", userAgent: [] },
    })
    const res = await POST(drainReq(line))
    const json = await res.json() as { candidates: number }
    expect(json.candidates).toBe(0)
  })

  test("only events (no candidates) writes only the events file", async () => {
    const line = JSON.stringify({
      source: "lambda",
      message: tripwireHitMessage(),
    })
    const res = await POST(drainReq(line))
    expect(res.status).toBe(200)
    expect(putCalls).toHaveLength(1)
    expect(putCalls[0].pathname.startsWith("tripwire/events/")).toBe(true)
  })

  test("only candidates (no events) writes only the candidates file", async () => {
    const line = JSON.stringify({
      proxy: {
        path: "/missing-page",
        userAgent: ["Mozilla/5.0"],
        statusCode: 404,
        clientIp: "1.1.1.1",
      },
    })
    const res = await POST(drainReq(line))
    expect(res.status).toBe(200)
    expect(putCalls).toHaveLength(1)
    expect(putCalls[0].pathname.startsWith("tripwire/candidates/")).toBe(true)
  })

  test("filename shape is <date>/<unix-ms>-<6-hex>.jsonl.gz", async () => {
    const line = JSON.stringify({
      proxy: {
        path: "/missing",
        userAgent: ["x"],
        statusCode: 404,
        clientIp: "x",
      },
    })
    await POST(drainReq(line))
    expect(putCalls).toHaveLength(1)
    const { pathname } = putCalls[0]
    expect(pathname).toMatch(
      /^tripwire\/candidates\/\d{4}-\d{2}-\d{2}\/\d+-[0-9a-f]{6}\.jsonl\.gz$/,
    )
  })

  test("blob options: private, gzip, no random suffix, no overwrite", async () => {
    const line = JSON.stringify({ message: tripwireHitMessage() })
    await POST(drainReq(line))
    expect(putCalls).toHaveLength(1)
    expect(putCalls[0].options).toMatchObject({
      access: "private",
      contentType: "application/gzip",
      addRandomSuffix: false,
      allowOverwrite: false,
    })
  })

  test("malformed ndjson lines are skipped, not fatal", async () => {
    const lines = [
      "this is not json",
      JSON.stringify({ message: tripwireHitMessage() }),
      "{also not valid",
    ].join("\n")
    const res = await POST(drainReq(lines))
    const json = await res.json() as { received: number; events: number }
    expect(res.status).toBe(200)
    expect(json.received).toBe(1)
    expect(json.events).toBe(1)
  })
})

describe("bucketRecords", () => {
  test("multiple events and candidates in one batch", () => {
    const records = [
      { message: tripwireHitMessage() },
      { message: tripwireHitMessage() },
      {
        proxy: {
          path: "/a",
          userAgent: ["x"],
          statusCode: 404,
          clientIp: "1",
        },
      },
      {
        proxy: {
          path: "/b",
          userAgent: ["y"],
          statusCode: 401,
          clientIp: "2",
        },
      },
      {
        proxy: {
          path: "/c",
          userAgent: ["z"],
          statusCode: 200,
          clientIp: "3",
        },
      },
    ]
    const buckets = bucketRecords(records)
    expect(buckets.events).toHaveLength(2)
    expect(buckets.candidates).toHaveLength(2)
  })

  test("randomBytes-derived filenames don't collide for sequential calls", () => {
    // Filename collision in concurrent batches would surface as a put()
    // failure (allowOverwrite: false). Ten quick draws should never collide.
    const seen = new Set<string>()
    for (let i = 0; i < 10; i++) {
      seen.add(randomBytes(3).toString("hex"))
    }
    expect(seen.size).toBe(10)
  })
})
