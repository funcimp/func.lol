// src/app/api/cron/tripwire-ingest/route.ts
//
// Job 1 of 3: copy events from the events/ blob prefix into the
// tripwire_events table. No ASN enrichment, no aggregate generation.
// Independent failure mode: if ingest is broken, the analytics file is
// still served from the last build-stats run.

import { NextResponse, type NextRequest } from "next/server"
import { ingestNewEvents } from "@/lib/tripwire/ingest"
import { checkCronAuth } from "@/lib/cron-helpers"
import { log } from "@/lib/log"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

const INGEST_DEADLINE_MS = 280_000

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authError = checkCronAuth(req)
  if (authError) return authError

  const startedAt = Date.now()
  const cronLog = log.child({ event: "cron.tripwire_ingest" })

  cronLog.info({ step: "start" })
  const result = await ingestNewEvents({
    onProgress: (e) => cronLog.info(e),
    deadlineMs: startedAt + INGEST_DEADLINE_MS,
  })
  cronLog.info({ step: "done", elapsed_ms: Date.now() - startedAt, ...result })

  return NextResponse.json({
    ok: true,
    elapsedMs: Date.now() - startedAt,
    ...result,
  })
}
