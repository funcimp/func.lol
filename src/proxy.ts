// src/proxy.ts
import { NextResponse, after, type NextRequest } from "next/server"
import { put } from "@vercel/blob"
import { createId } from "@paralleldrive/cuid2"
import {
  matchBait,
  categoryToBomb,
  type BombKind,
  type TripwireEvent,
} from "@/lib/tripwire/patterns"
import { guard, uaFamily } from "@/lib/tripwire/observe"

// Durable archive of a tripwire event. One file per event under
// events/<YYYY-MM-DD>/<ts-ms>-<req_id>.json — same shape used by the sync
// backfill tool, so live and backfilled writes are indistinguishable.
//
// after() keeps the function instance alive until the put resolves. Without
// it, cold-start singleton requests get suspended mid-flight: the in-flight
// HTTPS write to Blob is silently terminated by the runtime before it can
// succeed or fail. Failures are caught so a Blob outage doesn't surface
// anywhere visible beyond the Vercel runtime log.
function archiveEvent(event: TripwireEvent): void {
  const date = event.ts.slice(0, 10)
  const ms = new Date(event.ts).getTime()
  const id = event.req_id ?? createId()
  const pathname = `events/${date}/${ms}-${id}.json`
  after(() =>
    put(pathname, JSON.stringify(event), {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    }).catch((err) => console.error("[tripwire] blob write failed:", err)),
  )
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
      req_id: createId(),
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
    req_id: createId(),
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
  // Exclude statically-prerendered routes (/robots.txt, /sitemap.xml) from
  // middleware. They're built once at deploy time; running middleware on
  // them caused intermittent 404s on edge cache misses (Next.js 16 routed
  // some misses through the function path, which has no handler for those
  // paths and returned 404). Their bait-status is also already covered by
  // SAFE_EXACT_PATHS, so keeping the proxy out is purely a routing fix.
  matcher: ["/((?!_next/|api/|static/|robots\\.txt|sitemap\\.xml).*)"],
}
