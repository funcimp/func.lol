// src/proxy.ts
import { NextResponse, type NextRequest } from "next/server"
import { put } from "@vercel/blob"
import { randomBytes } from "node:crypto"
import {
  matchBait,
  categoryToBomb,
  type BombKind,
  type TripwireEvent,
} from "@/lib/tripwire/patterns"
import { guard, uaFamily } from "@/lib/tripwire/observe"

// Fire-and-forget durable archive of a tripwire event. One file per event
// under tripwire/events/<YYYY-MM-DD>/<unix-ms>-<rand>.json. Failures don't
// block the bomb response — console.log above stays as the 7-day Vercel-log
// debugging shim if Blob is briefly unreachable.
function archiveEvent(event: TripwireEvent): void {
  const date = new Date().toISOString().slice(0, 10)
  const filename = `${Date.now()}-${randomBytes(3).toString("hex")}.json`
  put(`tripwire/events/${date}/${filename}`, JSON.stringify(event), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
  }).catch((err) => console.error("[tripwire] blob write failed:", err))
}

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

  if (!guard(ip)) {
    const throttled: TripwireEvent = {
      event: "tripwire.throttled",
      ts: new Date().toISOString(),
      path: req.nextUrl.pathname,
      pattern: pattern.token,
      ip,
    }
    console.log(JSON.stringify(throttled))
    archiveEvent(throttled)
    return
  }

  const bomb: BombKind = pattern.bomb ?? categoryToBomb[pattern.category]

  // Raw IPs are stored intentionally so later analysis can correlate ASN /
  // BGP / threat-feed data. If any downstream surface (e.g. v2 stats panel
  // at /x/tripwire) needs anonymized data, anonymize at aggregation time,
  // not at capture.
  const hit: TripwireEvent = {
    event: "tripwire.hit",
    ts: new Date().toISOString(),
    path: req.nextUrl.pathname,
    query: req.nextUrl.search,
    pattern: pattern.token,
    category: pattern.category,
    bomb,
    ua_raw: ua.slice(0, 200),
    ua_family: uaFamily(ua),
    ip,
  }
  console.log(JSON.stringify(hit))
  archiveEvent(hit)

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
