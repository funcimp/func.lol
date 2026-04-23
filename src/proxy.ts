// src/proxy.ts
import { NextResponse, type NextRequest } from "next/server"
import { matchBait, categoryToBomb, type BombKind } from "@/lib/tripwire/patterns"
import { guard, hashIP, uaFamily } from "@/lib/tripwire/observe"

export async function proxy(req: NextRequest): Promise<Response | undefined> {
  // Active in production by default. TRIPWIRE_FORCE=1 overrides the gate so
  // end-to-end tests (Playwright against `next dev`) can exercise the proxy
  // without running a full production build. Local `next dev` without the
  // env var still passes through, keeping the no-self-bomb guarantee.
  if (process.env.NODE_ENV !== "production" && process.env.TRIPWIRE_FORCE !== "1") return

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

  // Rewrite to the internal bomb route. The route handler can set
  // Content-Encoding (the proxy cannot — Next.js strips it as a forbidden
  // middleware header). The rewrite is server-side; the scanner sees the
  // original bait URL, never /api/tripwire/bomb.
  const target = new URL(`/api/tripwire/bomb/${bomb}`, req.url)
  return NextResponse.rewrite(target)
}

export const config = {
  matcher: ["/((?!_next/|api/|static/).*)"],
}
