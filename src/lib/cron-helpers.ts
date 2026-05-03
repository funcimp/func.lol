// src/lib/cron-helpers.ts
//
// Shared boilerplate for the tripwire cron route handlers. Each route
// does ONE thing — this just removes the repeated auth check. Logging
// goes through the singleton in src/lib/log.ts.

import { NextResponse, type NextRequest } from "next/server"
import { log } from "@/lib/log"

export function checkCronAuth(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    log.error({ event: "cron.auth", reason: "no_secret" })
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 500 })
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }
  return null
}
