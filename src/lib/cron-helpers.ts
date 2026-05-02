// src/lib/cron-helpers.ts
//
// Shared boilerplate for the tripwire cron route handlers. Each route
// does ONE thing — this just removes the repeated auth check and the
// structured-log scaffolding from those handlers.

import { NextResponse, type NextRequest } from "next/server"

export function checkCronAuth(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error("[cron] CRON_SECRET not configured")
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 500 })
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }
  return null
}

export type CronLogger = (fields: Record<string, unknown>) => void

export function makeCronLogger(eventName: string, startedAt: number): CronLogger {
  return (fields) =>
    console.log(
      JSON.stringify({
        event: eventName,
        elapsed_ms: Date.now() - startedAt,
        ...fields,
      }),
    )
}
