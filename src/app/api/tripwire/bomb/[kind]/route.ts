// src/app/api/tripwire/bomb/[kind]/route.ts
//
// Internal route the proxy rewrites to when a bait path is matched.
// The proxy cannot set Content-Encoding (Next.js strips content-encoding,
// content-length, and transfer-encoding from middleware responses).
// Route handlers have no such filter.
//
// The bomb kind comes from the dynamic [kind] path segment, not a query
// string: Next.js rewrites preserve path routing, but `request.nextUrl`
// inside the target handler still reports the original request URL, so a
// query string on the rewrite target is invisible. A path segment survives.
//
// Direct probes of /api/tripwire/bomb/<kind> also serve a bomb. That is
// fine — anyone who probes the internal endpoint gets the thing they asked
// for. The /api/ prefix is in the proxy's SAFE_PREFIXES, so this route is
// never matched recursively by the tripwire matcher.
import { createReadStream } from "node:fs"
import path from "node:path"
import { Readable } from "node:stream"
import type { ReadableStream as WebReadableStream } from "node:stream/web"
import type { NextRequest } from "next/server"
import type { BombKind } from "@/lib/tripwire/patterns"

const CONTENT_TYPES: Record<BombKind, string> = {
  html: "text/html; charset=utf-8",
  json: "application/json; charset=utf-8",
  yaml: "application/yaml; charset=utf-8",
  env: "text/plain; charset=utf-8",
}

function isBombKind(v: string): v is BombKind {
  return v in CONTENT_TYPES
}

async function serveBomb(
  _req: NextRequest,
  { params }: { params: Promise<{ kind: string }> },
): Promise<Response> {
  const { kind } = await params
  if (!isBombKind(kind)) {
    return new Response("Not found", { status: 404 })
  }

  const filePath = path.join(process.cwd(), "public", `.bomb.${kind}.gz`)
  const nodeStream = createReadStream(filePath)
  const body = Readable.toWeb(nodeStream) as unknown as WebReadableStream<Uint8Array>

  return new Response(body as unknown as ReadableStream, {
    status: 200,
    headers: {
      "Content-Encoding": "gzip",
      "Content-Type": CONTENT_TYPES[kind],
      "Cache-Control": "no-store",
      // Hint to intermediate caches / CDNs that this response is already
      // encoding-negotiated. Discourages gzip -> brotli transcoding, which
      // would force a 2 GB decompression in the edge's memory.
      Vary: "Accept-Encoding",
    },
  })
}

// Scanners probe bait paths with every method — GET to fingerprint,
// POST for exploit payloads (e.g. /xmlrpc.php, webshell uploads), PUT and
// DELETE on REST endpoints, OPTIONS for method enumeration. Next.js routes
// 405 on unexported methods by default, which is worse than pointless here:
// it tells the scanner "nope, try something else" instead of feeding them
// the bomb. Export the same handler under every method.
export {
  serveBomb as GET,
  serveBomb as POST,
  serveBomb as PUT,
  serveBomb as PATCH,
  serveBomb as DELETE,
  serveBomb as HEAD,
  serveBomb as OPTIONS,
}
