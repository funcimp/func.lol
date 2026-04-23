// src/app/api/cron/tripwire-archive/route.ts
import { NextResponse, type NextRequest } from "next/server"
import { put, list, get } from "@vercel/blob"
import { gzipSync, gunzipSync } from "node:zlib"
import { type TripwireEvent, isTripwireEvent } from "@/lib/tripwire/patterns"
import { uaFamily } from "@/lib/tripwire/observe"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Every 12 hours: 03:00 and 15:00 UTC (see vercel.json crons entry). Each run
// archives the preceding 12 hours of logs. The window key is YYYY-MM-DDTHH
// where HH is the end-of-window hour (03 or 15). Two streams written per run:
//   tripwire/events/<key>.jsonl.gz     - tripwire.hit + tripwire.throttled
//   tripwire/candidates/<key>.jsonl.gz - non-bait 4xx responses
// Candidates feed the v3 discovery tool; bait paths never 4xx because the
// proxy intercepts them as 200 with the bomb.
const WINDOW_MS = 12 * 60 * 60 * 1000

interface CandidateEvent {
  event: "candidate.4xx"
  ts: string
  path: string
  status: number
  ua_raw: string
  ua_family: string
  ip: string
}

function windowForCron(now = new Date()): { from: number; to: number; key: string } {
  const toMs = now.getTime()
  const fromMs = toMs - WINDOW_MS
  const ymd = now.toISOString().slice(0, 10)
  const hh = now.getUTCHours().toString().padStart(2, "0")
  return { from: fromMs, to: toMs, key: `${ymd}T${hh}` }
}

function tripwireKey(e: TripwireEvent): string {
  return `${e.ts}|${e.event}|${e.pattern}|${e.ip}`
}

function candidateKey(e: CandidateEvent): string {
  return `${e.ts}|${e.path}|${e.status}|${e.ip}`
}

function verifyCronAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get("authorization")
  return header === `Bearer ${secret}`
}

/**
 * Fetch log lines from Vercel's Logs API for a time window.
 *
 * The Vercel Logs REST API is versioned; the exact endpoint and auth shape
 * should be verified against current docs:
 *   https://vercel.com/docs/rest-api
 *
 * The response is expected to be newline-delimited log lines. Each line is
 * either a stdout JSON record (our console.log payloads) or a request log
 * JSON record (Vercel's per-request records with status/path/ua/ip). Our
 * parsers handle either shape via best-effort field matching.
 *
 * On failure or missing env config the archiver no-ops gracefully rather
 * than failing the cron.
 */
async function fetchLogLines(from: number, to: number, key: string): Promise<string[]> {
  const token = process.env.VERCEL_API_TOKEN
  const projectId = process.env.VERCEL_PROJECT_ID
  if (!token || !projectId) return []

  const url = new URL(`https://api.vercel.com/v1/projects/${projectId}/logs`)
  url.searchParams.set("since", String(from))
  url.searchParams.set("until", String(to))
  url.searchParams.set("limit", "5000")

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    console.error(
      `[tripwire-archive] Vercel Logs API failed (status=${res.status}). ` +
      `Archive will be empty for ${key}. Verify VERCEL_API_TOKEN and endpoint shape.`,
    )
    return []
  }
  const text = await res.text()
  return text.split("\n").filter(Boolean)
}

function tryParseTripwireEvent(s: string): TripwireEvent | null {
  try {
    const obj: unknown = JSON.parse(s)
    return isTripwireEvent(obj) ? obj : null
  } catch {
    return null
  }
}

function parseTripwireEventLine(line: string): TripwireEvent | null {
  const whole = tryParseTripwireEvent(line)
  if (whole) return whole
  const first = line.indexOf("{")
  const last = line.lastIndexOf("}")
  if (first < 0 || last <= first) return null
  return tryParseTripwireEvent(line.slice(first, last + 1))
}

// Vercel request-log records vary by API version; try a handful of field
// names for each value. Returns null on anything we can't confidently parse.
function parseRequestLogLine(line: string): CandidateEvent | null {
  const first = line.indexOf("{")
  const last = line.lastIndexOf("}")
  if (first < 0 || last <= first) return null
  let obj: Record<string, unknown>
  try {
    obj = JSON.parse(line.slice(first, last + 1)) as Record<string, unknown>
  } catch {
    return null
  }

  const status = numberField(obj, ["statusCode", "status"])
  if (status === null || status < 400 || status >= 500) return null

  const ts = stringField(obj, ["timestamp", "ts", "time"])
  const path = stringField(obj, ["path", "url", "route", "requestPath"])
  if (!ts || !path) return null

  const ua = stringField(obj, ["userAgent", "ua", "requestUserAgent"]) ?? ""
  const ip = stringField(obj, ["clientIp", "ip", "remoteAddress", "requestIp"]) ?? ""

  return {
    event: "candidate.4xx",
    ts,
    path,
    status,
    ua_raw: ua.slice(0, 200),
    ua_family: uaFamily(ua),
    ip,
  }
}

function stringField(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === "string") return v
  }
  return null
}

function numberField(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === "number") return v
    if (typeof v === "string" && /^\d+$/.test(v)) return Number(v)
  }
  return null
}

interface Buckets {
  events: TripwireEvent[]
  candidates: CandidateEvent[]
}

function bucketLogLines(lines: string[]): Buckets {
  const events: TripwireEvent[] = []
  const candidates: CandidateEvent[] = []
  for (const line of lines) {
    const tw = parseTripwireEventLine(line)
    if (tw) { events.push(tw); continue }
    const cand = parseRequestLogLine(line)
    if (cand) candidates.push(cand)
  }
  return { events, candidates }
}

async function readExistingArchive<T>(
  pathname: string,
  parse: (line: string) => T | null,
): Promise<T[]> {
  const { blobs } = await list({ prefix: pathname })
  const hit = blobs.find((b) => b.pathname === pathname)
  if (!hit) return []
  const file = await get(hit.url, { access: "private" })
  if (!file || file.statusCode !== 200) return []
  const buf = Buffer.from(await new Response(file.stream).arrayBuffer())
  const text = gunzipSync(buf).toString("utf8")
  const out: T[] = []
  for (const line of text.split("\n")) {
    if (!line) continue
    const parsed = parse(line)
    if (parsed) out.push(parsed)
  }
  return out
}

function parseArchivedTripwireEvent(line: string): TripwireEvent | null {
  try {
    const obj: unknown = JSON.parse(line)
    return isTripwireEvent(obj) ? obj : null
  } catch {
    return null
  }
}

function parseArchivedCandidate(line: string): CandidateEvent | null {
  try {
    const obj = JSON.parse(line) as Partial<CandidateEvent>
    if (obj.event === "candidate.4xx"
        && typeof obj.ts === "string"
        && typeof obj.path === "string"
        && typeof obj.status === "number") {
      return obj as CandidateEvent
    }
  } catch { /* skip */ }
  return null
}

async function writeArchive<T extends { ts: string }>(
  pathname: string,
  existing: T[],
  incoming: T[],
  keyOf: (v: T) => string,
): Promise<{ existingCount: number; incomingCount: number; mergedCount: number }> {
  const merged = new Map<string, T>()
  for (const e of existing) merged.set(keyOf(e), e)
  for (const e of incoming) merged.set(keyOf(e), e)

  const jsonl = Array.from(merged.values())
    .sort((a, b) => a.ts.localeCompare(b.ts))
    .map((e) => JSON.stringify(e))
    .join("\n") + "\n"

  const gz = gzipSync(Buffer.from(jsonl, "utf8"), { level: 9 })

  await put(pathname, gz, {
    access: "private",
    contentType: "application/gzip",
    addRandomSuffix: false,
    allowOverwrite: true,
  })

  return {
    existingCount: existing.length,
    incomingCount: incoming.length,
    mergedCount: merged.size,
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  const { from, to, key } = windowForCron()
  const lines = await fetchLogLines(from, to, key)
  const { events: incomingEvents, candidates: incomingCandidates } = bucketLogLines(lines)

  const eventsPath = `tripwire/events/${key}.jsonl.gz`
  const candidatesPath = `tripwire/candidates/${key}.jsonl.gz`

  const [eventsResult, candidatesResult] = await Promise.all([
    incomingEvents.length === 0
      ? Promise.resolve({ existingCount: 0, incomingCount: 0, mergedCount: 0 })
      : (async () => {
          const existing = await readExistingArchive(eventsPath, parseArchivedTripwireEvent)
          return writeArchive(eventsPath, existing, incomingEvents, tripwireKey)
        })(),
    incomingCandidates.length === 0
      ? Promise.resolve({ existingCount: 0, incomingCount: 0, mergedCount: 0 })
      : (async () => {
          const existing = await readExistingArchive(candidatesPath, parseArchivedCandidate)
          return writeArchive(candidatesPath, existing, incomingCandidates, candidateKey)
        })(),
  ])

  return NextResponse.json({
    ok: true,
    key,
    events: eventsResult,
    candidates: candidatesResult,
  })
}
