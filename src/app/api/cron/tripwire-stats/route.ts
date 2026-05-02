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
// Time budget: maxDuration is 300s, but ingest gets a 240s deadline so
// buildAggregates + publishAggregates have headroom to finish even if
// ingest hits the cap. A partial-progress run is far more useful than a
// FUNCTION_INVOCATION_TIMEOUT with zero inserts; the next invocation
// picks up where this one left off (ingestion is dedup'd by event id).

import { NextResponse, type NextRequest } from "next/server"
import { revalidateTag } from "next/cache"
import { ingestNewEvents, type IngestLogEvent } from "@/lib/tripwire/ingest"
import { buildAggregates, publishAggregates } from "@/lib/tripwire/stats"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

const INGEST_BUDGET_MS = 240_000

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
  const emit = (fields: Record<string, unknown>) =>
    console.log(JSON.stringify({
      event: "cron.tripwire_stats",
      elapsed_ms: Date.now() - startedAt,
      ...fields,
    }))
  const onProgress = (e: IngestLogEvent) => emit(e)

  emit({ step: "ingest.start" })
  const ingest = await ingestNewEvents({
    onProgress,
    deadlineMs: startedAt + INGEST_BUDGET_MS,
  })
  emit({
    step: "ingest.done",
    listed: ingest.listed,
    known: ingest.alreadyKnown,
    inserted: ingest.inserted,
    skipped: ingest.skipped,
  })

  emit({ step: "aggregate.start" })
  const aggregates = await buildAggregates()
  emit({
    step: "aggregate.done",
    total: aggregates.lifetime.totalEvents,
    ips: aggregates.lifetime.distinctIps,
    asns: aggregates.lifetime.distinctAsns,
  })

  emit({ step: "publish.start" })
  await publishAggregates(aggregates)
  revalidateTag("tripwire-aggregates", "max")
  emit({ step: "publish.done" })

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
