// proxy.ts
import { createReadStream } from "node:fs"
import path from "node:path"
import { Readable } from "node:stream"
import type { ReadableStream as WebReadableStream } from "node:stream/web"
import type { NextRequest } from "next/server"
import { matchBait, categoryToBomb, type BombKind } from "@/lib/tripwire/patterns"
import { guard, hashIP, uaFamily } from "@/lib/tripwire/observe"

const CONTENT_TYPES: Record<BombKind, string> = {
  html: "text/html; charset=utf-8",
  json: "application/json; charset=utf-8",
  yaml: "application/yaml; charset=utf-8",
  env: "text/plain; charset=utf-8",
}

export async function proxy(req: NextRequest): Promise<Response | undefined> {
  if (process.env.NODE_ENV !== "production") return

  const pattern = matchBait(req.nextUrl)
  if (!pattern) return

  const ua = req.headers.get("user-agent") ?? ""
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? ""
  const ipHash = hashIP(ip)

  if (!guard(ipHash)) {
    console.log(JSON.stringify({
      event: "tripwire.throttled",
      ts: new Date().toISOString(),
      path: req.nextUrl.pathname,
      pattern: pattern.token,
      ip_hash: ipHash,
    }))
    return
  }

  const bomb: BombKind = pattern.bomb ?? categoryToBomb[pattern.category]
  const filePath = path.join(process.cwd(), "public", `.bomb.${bomb}.gz`)
  const nodeStream = createReadStream(filePath)
  const body = Readable.toWeb(nodeStream) as unknown as WebReadableStream<Uint8Array>

  console.log(JSON.stringify({
    event: "tripwire.hit",
    ts: new Date().toISOString(),
    path: req.nextUrl.pathname,
    query: req.nextUrl.search,
    pattern: pattern.token,
    category: pattern.category,
    bomb,
    ua_raw: ua.slice(0, 200),
    ua_family: uaFamily(ua),
    ip_hash: ipHash,
  }))

  return new Response(body as unknown as ReadableStream, {
    status: 200,
    headers: {
      "Content-Encoding": "gzip",
      "Content-Type": CONTENT_TYPES[bomb],
      "Cache-Control": "no-store",
    },
  })
}

export const config = {
  matcher: ["/((?!_next/|api/|static/).*)"],
}
