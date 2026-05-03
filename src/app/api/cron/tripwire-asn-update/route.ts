// src/app/api/cron/tripwire-asn-update/route.ts
//
// Job 2 of 3: pull a fresh GeoLite2-ASN.mmdb from MaxMind and put it
// in blob at geoip/GeoLite2-ASN.mmdb. Build-stats reads that blob.
// Independent failure mode: if this is broken, build-stats keeps using
// whatever ASN db is currently in blob.

import { NextResponse, type NextRequest } from "next/server"
import { syncGeoipToBlob } from "@/lib/tripwire/sync-geoip"
import { checkCronAuth } from "@/lib/cron-helpers"
import { log } from "@/lib/log"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authError = checkCronAuth(req)
  if (authError) return authError

  const startedAt = Date.now()
  const cronLog = log.child({ event: "cron.tripwire_asn_update" })

  cronLog.info({ step: "start" })
  const result = await syncGeoipToBlob()
  cronLog.info({ step: "done", elapsed_ms: Date.now() - startedAt, ...result })

  return NextResponse.json({
    ok: true,
    elapsedMs: Date.now() - startedAt,
    ...result,
  })
}
