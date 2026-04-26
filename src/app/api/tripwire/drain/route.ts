// src/app/api/tripwire/drain/route.ts
//
// Vercel Log Drain ingest endpoint. Replaces the polling cron that called
// the undocumented /v1/projects/<id>/logs Vercel REST endpoint and silently
// returned zero records on every run.
//
// Vercel pushes NDJSON batches to this URL whenever new logs arrive (every
// few seconds during traffic). We verify the HMAC-SHA1 signature, parse
// each record, route it to the appropriate bucket, and append per-batch
// gzipped JSONL files to private Blob storage:
//
//   tripwire/events/<YYYY-MM-DD>/<unix-ms>-<rand>.jsonl.gz
//   tripwire/candidates/<YYYY-MM-DD>/<unix-ms>-<rand>.jsonl.gz
//
// Per-batch immutable files mean no read-merge-rewrite. Date prefixes give
// a cheap query unit. <rand> disambiguates concurrent batches that share
// a millisecond.
//
// Schema reference: https://vercel.com/docs/drains/reference/logs
// Signature reference: https://vercel.com/docs/drains/security
import { NextResponse, type NextRequest } from "next/server"
import { put } from "@vercel/blob"
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto"
import { gzipSync } from "node:zlib"
import { isTripwireEvent, matchBait, type TripwireEvent } from "@/lib/tripwire/patterns"
import { uaFamily } from "@/lib/tripwire/observe"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface CandidateEvent {
  event: "candidate.4xx"
  ts: string
  path: string
  status: number
  ua_raw: string
  ua_family: string
  ip: string
}

// Subset of the documented log drain record shape we actually read. Vercel
// sends many more fields (deploymentId, requestId, traceId, ja3Digest, etc.)
// but they don't influence routing here.
interface DrainProxy {
  timestamp?: number
  method?: string
  host?: string
  path?: string
  userAgent?: string[]
  region?: string
  statusCode?: number
  clientIp?: string
}

interface DrainRecord {
  source?: string
  timestamp?: number
  level?: string
  message?: string
  type?: string
  proxy?: DrainProxy
}

function verifySignature(secret: string, raw: Buffer, header: string | null): boolean {
  if (!header) return false
  const expected = createHmac("sha1", secret).update(raw).digest()
  let provided: Buffer
  try {
    provided = Buffer.from(header, "hex")
  } catch {
    return false
  }
  if (provided.length !== expected.length) return false
  return timingSafeEqual(provided, expected)
}

function parseRecord(line: string): DrainRecord | null {
  try {
    return JSON.parse(line) as DrainRecord
  } catch {
    return null
  }
}

function tryParseTripwireEvent(message: string): TripwireEvent | null {
  try {
    const obj: unknown = JSON.parse(message)
    return isTripwireEvent(obj) ? obj : null
  } catch {
    return null
  }
}

function recordToCandidate(rec: DrainRecord): CandidateEvent | null {
  const proxy = rec.proxy
  if (!proxy) return null
  const status = proxy.statusCode
  if (typeof status !== "number" || status < 400 || status >= 500) return null
  const path = proxy.path
  if (typeof path !== "string") return null
  // Bait paths return 200 from the bomb route, but defensively skip if a 4xx
  // ever lands on one (e.g. a bait path falls outside the proxy matcher's
  // SAFE_PREFIXES because /api/tripwire/drain is itself excluded).
  try {
    if (matchBait(new URL(path, "https://func.lol"))) return null
  } catch {
    return null
  }
  const ua = proxy.userAgent?.[0] ?? ""
  const tsMs = rec.timestamp ?? proxy.timestamp ?? Date.now()
  return {
    event: "candidate.4xx",
    ts: new Date(tsMs).toISOString(),
    path,
    status,
    ua_raw: ua.slice(0, 200),
    ua_family: uaFamily(ua),
    ip: proxy.clientIp ?? "",
  }
}

interface Buckets {
  events: TripwireEvent[]
  candidates: CandidateEvent[]
}

export function bucketRecords(records: DrainRecord[]): Buckets {
  const events: TripwireEvent[] = []
  const candidates: CandidateEvent[] = []
  for (const rec of records) {
    if (rec.message) {
      const tw = tryParseTripwireEvent(rec.message)
      if (tw) {
        events.push(tw)
        continue
      }
    }
    const cand = recordToCandidate(rec)
    if (cand) candidates.push(cand)
  }
  return { events, candidates }
}

function dateKey(ts: number = Date.now()): string {
  return new Date(ts).toISOString().slice(0, 10)
}

function batchFilename(): string {
  return `${Date.now()}-${randomBytes(3).toString("hex")}.jsonl.gz`
}

async function writeBatch<T>(prefix: string, items: T[]): Promise<string | null> {
  if (items.length === 0) return null
  const pathname = `${prefix}/${dateKey()}/${batchFilename()}`
  const jsonl = items.map((e) => JSON.stringify(e)).join("\n") + "\n"
  const gz = gzipSync(Buffer.from(jsonl, "utf8"), { level: 9 })
  await put(pathname, gz, {
    access: "private",
    contentType: "application/gzip",
    addRandomSuffix: false,
    allowOverwrite: false,
  })
  return pathname
}

export async function POST(req: NextRequest): Promise<Response> {
  const secret = process.env.TRIPWIRE_DRAIN_SECRET
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "TRIPWIRE_DRAIN_SECRET not configured" },
      { status: 500 },
    )
  }

  const raw = Buffer.from(await req.arrayBuffer())
  const sig = req.headers.get("x-vercel-signature")
  if (!verifySignature(secret, raw, sig)) {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 403 })
  }

  const records: DrainRecord[] = []
  for (const line of raw.toString("utf8").split("\n")) {
    if (!line) continue
    const rec = parseRecord(line)
    if (rec) records.push(rec)
  }

  const { events, candidates } = bucketRecords(records)
  const [eventsPath, candidatesPath] = await Promise.all([
    writeBatch("tripwire/events", events),
    writeBatch("tripwire/candidates", candidates),
  ])

  return NextResponse.json({
    ok: true,
    received: records.length,
    events: events.length,
    candidates: candidates.length,
    files: { events: eventsPath, candidates: candidatesPath },
  })
}
