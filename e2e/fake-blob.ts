// e2e/fake-blob.ts
//
// In-memory stand-in for Vercel Blob. Run as a Playwright webServer
// alongside `next dev`. Honors the subset of the blob HTTP surface that
// proxy.ts (PUT events), aggregates.ts (GET stats), and ingest.ts
// (LIST events) actually use.
//
// Seeds `stats/tripwire-aggregates.json` from the fixture so the
// tripwire page renders real numbers instead of an error boundary.
//
// Not a fidelity emulator. If a test needs a behavior the real
// platform has (signed URLs, multi-part uploads, store-id auth), add
// it here explicitly.

import http from "node:http"
import { STATS_BLOB_KEY } from "../src/lib/tripwire/aggregate-shape"
import { FIXTURE_AGGREGATES } from "./fixtures/aggregates"

interface StoredBlob {
  body: Buffer
  contentType: string
  uploadedAt: string
  size: number
}

const PORT = Number(process.env.FAKE_BLOB_PORT ?? 7777)
const store = new Map<string, StoredBlob>()

function setBlob(pathname: string, body: Buffer, contentType: string): void {
  store.set(pathname, {
    body,
    contentType,
    uploadedAt: new Date().toISOString(),
    size: body.length,
  })
}

setBlob(
  STATS_BLOB_KEY,
  Buffer.from(JSON.stringify(FIXTURE_AGGREGATES)),
  "application/json",
)

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
    req.on("end", () => resolve(Buffer.concat(chunks)))
    req.on("error", reject)
  })
}

function listResponse(prefix: string): { blobs: Array<{ pathname: string; url: string; size: number; uploadedAt: string }>; hasMore: false } {
  const blobs = [...store.entries()]
    .filter(([pathname]) => pathname.startsWith(prefix))
    .map(([pathname, blob]) => ({
      pathname,
      url: `http://localhost:${PORT}/${pathname}`,
      size: blob.size,
      uploadedAt: blob.uploadedAt,
    }))
  return { blobs, hasMore: false }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`)

    if (req.method === "GET" && url.pathname === "/_health") {
      res.writeHead(200, { "content-type": "text/plain" })
      res.end("ok")
      return
    }

    if (req.method === "GET" && url.pathname === "/api/blob/") {
      const prefix = url.searchParams.get("prefix") ?? ""
      res.writeHead(200, { "content-type": "application/json" })
      res.end(JSON.stringify(listResponse(prefix)))
      return
    }

    const pathname = url.pathname.replace(/^\/+/, "")

    if (req.method === "PUT") {
      const body = await readBody(req)
      const contentType = req.headers["content-type"]?.toString() ?? "application/octet-stream"
      setBlob(pathname, body, contentType)
      res.writeHead(200, { "content-type": "application/json" })
      res.end(JSON.stringify({ url: `http://localhost:${PORT}/${pathname}`, pathname }))
      return
    }

    if (req.method === "GET") {
      const blob = store.get(pathname)
      if (!blob) {
        res.writeHead(404, { "content-type": "text/plain" })
        res.end("not found")
        return
      }
      res.writeHead(200, { "content-type": blob.contentType })
      res.end(blob.body)
      return
    }

    res.writeHead(405, { "content-type": "text/plain" })
    res.end("method not allowed")
  } catch (err) {
    res.writeHead(500, { "content-type": "text/plain" })
    res.end(`fake blob error: ${err instanceof Error ? err.message : String(err)}`)
  }
})

server.listen(PORT, () => {
  console.log(`[fake-blob] listening on http://localhost:${PORT}`)
})
