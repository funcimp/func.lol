// src/app/api/cron/tripwire-stats/route.ts
//
// Vercel cron endpoint that refreshes the tripwire stats aggregate. Runs
// the same ingest + buildAggregates path as scripts/tripwire/*.ts, then
// publishes the aggregate JSON to blob at stats/tripwire-aggregates.json.
//
// The site reads that blob via ISR, so this cron is what keeps the
// rendered page near-fresh even when traffic is low. ISR's stale-while-
// revalidate handles the high-traffic path.
//
// Auth: Vercel sends `Authorization: Bearer ${CRON_SECRET}`. Reject any
// request that doesn't match. Without this, anyone can hit this URL and
// drive load against Neon + Blob from the open internet.
//
// The .mmdb is bundled with the deploy via outputFileTracingIncludes in
// next.config.ts. process.cwd() in a Vercel function is the project root,
// which is where data/GeoLite2-ASN.mmdb lives at deploy time.

import { NextResponse, type NextRequest } from "next/server"
import { revalidateTag } from "next/cache"
import { ingestNewEvents } from "@/lib/tripwire/ingest"
import { buildAggregates, publishAggregates } from "@/lib/tripwire/stats"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error("[cron/tripwire-stats] CRON_SECRET not configured")
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 500 })
  }
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${secret}`) return unauthorized()

  const startedAt = Date.now()
  const log = (msg: string) => console.log(`[cron/tripwire-stats] ${msg}`)

  log("ingest starting")
  const ingest = await ingestNewEvents({ onProgress: log })
  log(
    `ingest done · listed=${ingest.listed} known=${ingest.alreadyKnown} ` +
      `inserted=${ingest.inserted} skipped=${ingest.skipped}`,
  )

  log("aggregate starting")
  const aggregates = await buildAggregates()
  log(
    `aggregate done · total=${aggregates.lifetime.totalEvents} ` +
      `ips=${aggregates.lifetime.distinctIps} asns=${aggregates.lifetime.distinctAsns}`,
  )

  log("publish starting")
  await publishAggregates(aggregates)
  revalidateTag("tripwire-aggregates", "max")
  log("publish done")

  return NextResponse.json({
    ok: true,
    elapsedMs: Date.now() - startedAt,
    ingest,
    aggregates: {
      generatedAt: aggregates.generatedAt,
      totalEvents: aggregates.lifetime.totalEvents,
      distinctIps: aggregates.lifetime.distinctIps,
      distinctAsns: aggregates.lifetime.distinctAsns,
    },
  })
}
