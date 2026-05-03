// src/app/api/cron/tripwire-build-stats/route.ts
//
// Job 3 of 3: read DB + ASN blob, generate the analytics JSON, write
// it to blob at stats/tripwire-aggregates.json. The site reads that
// blob and renders it. Independent failure mode: if this is broken,
// the page keeps serving the last successfully-published analytics.

import { NextResponse, type NextRequest } from "next/server"
import { revalidateTag } from "next/cache"
import { buildAggregates, publishAggregates } from "@/lib/tripwire/stats"
import { checkCronAuth } from "@/lib/cron-helpers"
import { log } from "@/lib/log"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authError = checkCronAuth(req)
  if (authError) return authError

  const startedAt = Date.now()
  const cronLog = log.child({ event: "cron.tripwire_build_stats" })

  cronLog.info({ step: "build_start" })
  const aggregates = await buildAggregates()
  cronLog.info({
    step: "build_done",
    elapsed_ms: Date.now() - startedAt,
    total: aggregates.lifetime.totalEvents,
    ips: aggregates.lifetime.distinctIps,
    asns: aggregates.lifetime.distinctAsns,
  })

  cronLog.info({ step: "publish_start" })
  await publishAggregates(aggregates)
  revalidateTag("tripwire-aggregates", "max")
  cronLog.info({ step: "publish_done", elapsed_ms: Date.now() - startedAt })

  return NextResponse.json({
    ok: true,
    elapsedMs: Date.now() - startedAt,
    generatedAt: aggregates.generatedAt,
    totalEvents: aggregates.lifetime.totalEvents,
    distinctIps: aggregates.lifetime.distinctIps,
    distinctAsns: aggregates.lifetime.distinctAsns,
  })
}
