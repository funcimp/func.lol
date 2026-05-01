// src/app/api/tripwire/bomb-demo/[kind]/route.ts
//
// Browser-safe (~2 MB decompressed) version of the production bombs.
// Served to the BombDemo client component on /x/tripwire so a visitor
// can click a button and watch their browser inflate one. Same encoding
// trick as the production route — the file is precompressed gzip and
// the response advertises Content-Encoding: gzip so the browser inflates
// it for free.

import { createReadStream } from "node:fs"
import path from "node:path"
import { Readable } from "node:stream"
import type { ReadableStream as WebReadableStream } from "node:stream/web"
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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ kind: string }> },
): Promise<Response> {
  const { kind } = await params
  if (!isBombKind(kind)) {
    return new Response("Not found", { status: 404 })
  }

  const filePath = path.join(process.cwd(), "public", `.bomb-demo.${kind}.gz`)
  const nodeStream = createReadStream(filePath)
  const body = Readable.toWeb(nodeStream) as unknown as WebReadableStream<Uint8Array>

  return new Response(body as unknown as ReadableStream, {
    status: 200,
    headers: {
      "Content-Encoding": "gzip",
      "Content-Type": CONTENT_TYPES[kind],
      "Cache-Control": "public, max-age=3600",
      Vary: "Accept-Encoding",
    },
  })
}
