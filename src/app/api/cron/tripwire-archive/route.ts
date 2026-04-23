// src/app/api/cron/tripwire-archive/route.ts
import { NextResponse, type NextRequest } from "next/server"
import { put, list, get } from "@vercel/blob"
import { gzipSync, gunzipSync } from "node:zlib"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Lightweight shape of the event lines we care about.
interface TripwireEvent {
  event: "tripwire.hit" | "tripwire.throttled"
  ts: string
  [k: string]: unknown
}

// Cron fires at 03:00 UTC (see vercel.json crons entry). This function and
// the Logs API query window below must agree on UTC — do not "fix" one
// without the other.
function yesterdayUTC(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

function eventKey(e: TripwireEvent): string {
  return `${e.ts}|${e.event}|${e.pattern ?? ""}|${e.ip_hash ?? ""}`
}

function verifyCronAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get("authorization")
  return header === `Bearer ${secret}`
}

/**
 * Fetch the previous UTC day's logs from Vercel's Logs API.
 *
 * The Vercel Logs REST API is versioned; the exact endpoint and auth shape
 * should be verified against current docs before deploying:
 *   https://vercel.com/docs/rest-api
 *
 * This implementation follows the current documented shape as of the plan's
 * authoring. If the response is empty (no logs, or missing env config), the
 * archiver no-ops gracefully rather than failing the cron.
 */
async function fetchLogLinesForDate(date: string): Promise<string[]> {
  const token = process.env.VERCEL_API_TOKEN
  const projectId = process.env.VERCEL_PROJECT_ID
  if (!token || !projectId) return []

  const from = new Date(`${date}T00:00:00.000Z`).getTime()
  const nextDay = new Date(from + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const to = new Date(`${nextDay}T00:00:00.000Z`).getTime()
  const url = new URL(`https://api.vercel.com/v1/projects/${projectId}/logs`)
  url.searchParams.set("since", String(from))
  url.searchParams.set("until", String(to))
  url.searchParams.set("limit", "5000")

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    console.error(
      `[tripwire-archive] Vercel Logs API failed (status=${res.status}). ` +
      `Archive will be empty for ${date}. Verify VERCEL_API_TOKEN and endpoint shape.`,
    )
    return []
  }
  const text = await res.text()
  return text.split("\n").filter(Boolean)
}

function parseEventLine(line: string): TripwireEvent | null {
  // Try whole-line parse first (the happy path for our console.log JSON).
  try {
    const obj = JSON.parse(line) as Partial<TripwireEvent>
    if (obj.event === "tripwire.hit" || obj.event === "tripwire.throttled") {
      return obj as TripwireEvent
    }
  } catch {
    // Fall through to substring extraction.
  }
  // Fallback: carve out the first balanced {...} on the line.
  const first = line.indexOf("{")
  const last = line.lastIndexOf("}")
  if (first < 0 || last <= first) return null
  try {
    const obj = JSON.parse(line.slice(first, last + 1)) as Partial<TripwireEvent>
    if (obj.event === "tripwire.hit" || obj.event === "tripwire.throttled") {
      return obj as TripwireEvent
    }
  } catch {
    // Skip unparseable line.
  }
  return null
}

function extractTripwireEvents(lines: string[]): TripwireEvent[] {
  const out: TripwireEvent[] = []
  for (const line of lines) {
    const e = parseEventLine(line)
    if (e) out.push(e)
  }
  return out
}

async function readExistingArchive(date: string): Promise<TripwireEvent[]> {
  const prefix = `tripwire/events/${date}.jsonl.gz`
  const { blobs } = await list({ prefix })
  const hit = blobs.find((b) => b.pathname === prefix)
  if (!hit) return []
  // Private blob: read back via get(), not fetch(). Returns { stream, ... }.
  const file = await get(hit.url, { access: "private" })
  if (!file || file.statusCode !== 200) return []
  const buf = Buffer.from(await new Response(file.stream).arrayBuffer())
  const text = gunzipSync(buf).toString("utf8")
  const out: TripwireEvent[] = []
  for (const line of text.split("\n")) {
    if (!line) continue
    try { out.push(JSON.parse(line) as TripwireEvent) } catch { /* skip */ }
  }
  return out
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  const date = yesterdayUTC()
  const lines = await fetchLogLinesForDate(date)
  const incoming = extractTripwireEvents(lines)

  const existing = incoming.length === 0 ? [] : await readExistingArchive(date)

  if (incoming.length === 0) {
    return NextResponse.json({
      ok: true,
      date,
      existingCount: 0,
      incomingCount: 0,
      mergedCount: 0,
      added: 0,
      message: "no events to archive",
    })
  }

  const merged = new Map<string, TripwireEvent>()
  for (const e of existing) merged.set(eventKey(e), e)
  for (const e of incoming) merged.set(eventKey(e), e)

  const jsonl = Array.from(merged.values())
    .sort((a, b) => a.ts.localeCompare(b.ts))
    .map((e) => JSON.stringify(e))
    .join("\n") + "\n"

  const gz = gzipSync(Buffer.from(jsonl, "utf8"), { level: 9 })

  await put(`tripwire/events/${date}.jsonl.gz`, gz, {
    access: "private",
    contentType: "application/gzip",
    addRandomSuffix: false,
    allowOverwrite: true,
  })

  return NextResponse.json({
    ok: true,
    date,
    existingCount: existing.length,
    incomingCount: incoming.length,
    mergedCount: merged.size,
    added: merged.size - existing.length,
  })
}
