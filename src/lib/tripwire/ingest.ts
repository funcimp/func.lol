// src/lib/tripwire/ingest.ts
//
// One job: copy events from the events/ blob prefix into the
// tripwire_events table. Dedup by id (the slug from the blob filename).
// No ASN enrichment, no aggregate building. ASN lookups happen later
// at query time in build-stats.
//
// Filename shape from src/proxy.ts: events/<YYYY-MM-DD>/<ms>-<id>.json.
// The id is everything after the first hyphen and before .json.
//
// Pure library: no console.log, no process.exit. Callers (the CLI script
// and the cron route) decide how to log and surface results.

import { inArray } from "drizzle-orm"
import { getDb, schema } from "@/db"
import { log } from "@/lib/log"
import { isTripwireEvent, type TripwireEvent } from "@/lib/tripwire/patterns"

const ilog = log.child({ event: "tripwire.ingest" })

const DEFAULT_BATCH = 200
const ID_LOOKUP_CHUNK = 1000

// Structured-log shape. Callers (cron route + CLI scripts) get a single
// JSON line per emit. Match the pattern src/proxy.ts already uses for
// tripwire.hit / tripwire.throttled events.
export interface IngestLogEvent {
  step: string
  [field: string]: unknown
}

export interface IngestOptions {
  batchSize?: number
  onProgress?: (event: IngestLogEvent) => void
  // Stop ingesting (and return what's done so far) when wall-clock crosses
  // this absolute deadline timestamp (ms since epoch). Lets the cron route
  // bail before the platform kills it at maxDuration, so each run makes
  // partial progress instead of timing out with zero inserts.
  deadlineMs?: number
}

export interface IngestResult {
  listed: number
  alreadyKnown: number
  inserted: number
  skipped: number
  unrecognized: number
}

interface BlobRef {
  pathname: string
  url: string
  id: string
}

// events/2026-04-30/1777563007310-kj5ynyxqlmw81z9dlc8zpqxf.json
//                                 ^^^^^^^^^^^^^^^^^^^^^^^^
function idFromPathname(pathname: string): string | null {
  const match = pathname.match(/\/(\d+)-(.+)\.json$/)
  return match ? match[2] : null
}

interface BlobListPage {
  blobs: Array<{ pathname: string; url: string; size: number; uploadedAt: string }>
  cursor?: string
  hasMore: boolean
}

// Direct call to Vercel Blob's list API. We bypass @vercel/blob's list()
// for the same reason we bypass get(): the SDK ends in `apiResponse.json()`
// after the Response object goes out of scope, which under Bun on Vercel
// can leave the body stream stuck waiting for EOF. By keeping our own
// Response in scope across the .json() drain, the request completes.
async function listBlobsPage(prefix: string, cursor: string | undefined): Promise<BlobListPage> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is not set")
  const params = new URLSearchParams({ prefix })
  if (cursor) params.set("cursor", cursor)
  const res = await fetch(`https://vercel.com/api/blob/?${params}`, {
    headers: {
      authorization: `Bearer ${token}`,
      "x-api-version": "12",
    },
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(`blob list failed: ${res.status} ${res.statusText}`)
  }
  return (await res.json()) as BlobListPage
}

// Bound the listing to the trailing INGEST_WINDOW_DAYS UTC dates. Cron runs
// every 5 minutes, so a 2-day window leaves 24h+ of slack against any cron
// outage. Events older than the window won't be auto-ingested by the cron;
// the CLI script (scripts/tripwire/ingest-events.ts) still walks the full
// events/ prefix and can backfill manually if a longer outage happens.
const INGEST_WINDOW_DAYS = 2

export function recentDatePrefixes(now: Date): string[] {
  const out: string[] = []
  for (let i = 0; i < INGEST_WINDOW_DAYS; i++) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    out.push(`events/${d.toISOString().slice(0, 10)}/`)
  }
  return out
}

async function listAllBlobs(
  log: (e: IngestLogEvent) => void,
): Promise<{ refs: BlobRef[]; unrecognized: number }> {
  const refs: BlobRef[] = []
  let unrecognized = 0
  for (const prefix of recentDatePrefixes(new Date())) {
    let cursor: string | undefined
    let page = 0
    do {
      page++
      const t0 = Date.now()
      ilog.debug({ step: "list.page_start", prefix, page, cursor: cursor ?? null })
      const result = await listBlobsPage(prefix, cursor)
      ilog.debug({
        step: "list.page_done",
        prefix,
        page,
        elapsed_ms: Date.now() - t0,
        blobs: result.blobs.length,
        has_cursor: Boolean(result.cursor),
      })
      for (const blob of result.blobs) {
        const id = idFromPathname(blob.pathname)
        if (!id) {
          unrecognized++
          log({ step: "list.unrecognized_blob", pathname: blob.pathname })
          continue
        }
        refs.push({ pathname: blob.pathname, url: blob.url, id })
      }
      cursor = result.cursor
    } while (cursor)
  }
  return { refs, unrecognized }
}

async function fetchEvent(
  url: string,
  log: (e: IngestLogEvent) => void,
): Promise<TripwireEvent | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is not set")

  // Direct fetch instead of @vercel/blob's get(): get() returns
  // response.body and lets the Response go out of scope, which under
  // Bun on Vercel can leave the body stream stuck waiting for EOF.
  // Each event JSON is read once, so no caching.
  const t0 = Date.now()
  ilog.debug({ step: "fetch_event.fetch_start", url })
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  ilog.debug({
    step: "fetch_event.fetch_done",
    elapsed_ms: Date.now() - t0,
    status: res.status,
  })
  if (!res.ok) {
    log({ step: "fetch_event.bad_status", url, statusCode: res.status })
    return null
  }
  const t1 = Date.now()
  const text = await res.text()
  ilog.debug({
    step: "fetch_event.drain_done",
    elapsed_ms: Date.now() - t1,
    bytes: text.length,
  })
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    log({ step: "fetch_event.malformed_json", url })
    return null
  }
  if (!isTripwireEvent(parsed)) {
    log({ step: "fetch_event.not_tripwire", url })
    return null
  }
  return parsed
}

function rowFromEvent(ref: BlobRef, event: TripwireEvent): schema.NewTripwireEventRow {
  return {
    id: ref.id,
    reqId: event.req_id ?? null,
    event: event.event,
    ts: new Date(event.ts),
    path: event.path,
    pattern: event.pattern,
    ip: event.ip,
    query: event.query ?? null,
    category: event.category ?? null,
    bomb: event.bomb ?? null,
    uaRaw: event.ua_raw ?? null,
    uaFamily: event.ua_family ?? null,
    asn: null,
    asnName: null,
    blobPathname: ref.pathname,
  }
}

async function existingIds(ids: string[]): Promise<Set<string>> {
  const out = new Set<string>()
  if (ids.length === 0) return out
  const db = getDb()
  for (let i = 0; i < ids.length; i += ID_LOOKUP_CHUNK) {
    const chunk = ids.slice(i, i + ID_LOOKUP_CHUNK)
    const t0 = Date.now()
    ilog.debug({ step: "dedup.chunk_start", offset: i, size: chunk.length })
    const rows = await db
      .select({ id: schema.tripwireEvents.id })
      .from(schema.tripwireEvents)
      .where(inArray(schema.tripwireEvents.id, chunk))
    ilog.debug({
      step: "dedup.chunk_done",
      offset: i,
      elapsed_ms: Date.now() - t0,
      matched: rows.length,
    })
    for (const r of rows) out.add(r.id)
  }
  return out
}

async function insertBatch(rows: schema.NewTripwireEventRow[]): Promise<number> {
  if (rows.length === 0) return 0
  const db = getDb()
  const t0 = Date.now()
  ilog.debug({ step: "insert.start", rows: rows.length })
  await db.insert(schema.tripwireEvents).values(rows).onConflictDoNothing()
  ilog.debug({ step: "insert.done", rows: rows.length, elapsed_ms: Date.now() - t0 })
  return rows.length
}

export async function ingestNewEvents(opts: IngestOptions = {}): Promise<IngestResult> {
  const batchSize = opts.batchSize ?? DEFAULT_BATCH
  const log = opts.onProgress ?? (() => {})
  const deadlineMs = opts.deadlineMs ?? Number.POSITIVE_INFINITY
  const overDeadline = () => Date.now() >= deadlineMs

  const tList = Date.now()
  const { refs, unrecognized } = await listAllBlobs(log)
  log({ step: "list.done", count: refs.length, list_ms: Date.now() - tList })

  const tDedup = Date.now()
  const allIds = refs.map((r) => r.id)
  const known = await existingIds(allIds)
  const todo = refs.filter((r) => !known.has(r.id))
  log({ step: "dedup.done", known: known.size, todo: todo.length, dedup_ms: Date.now() - tDedup })

  let inserted = 0
  let skipped = 0
  let bailedAtBatch: number | null = null
  for (let i = 0; i < todo.length; i += batchSize) {
    const batchN = Math.floor(i / batchSize) + 1
    if (overDeadline()) {
      bailedAtBatch = batchN
      log({ step: "deadline.bail_pre_batch", batch: batchN })
      break
    }
    const slice = todo.slice(i, i + batchSize)
    const tBatch = Date.now()
    const rows: schema.NewTripwireEventRow[] = []
    for (const ref of slice) {
      if (overDeadline()) {
        log({ step: "deadline.bail_mid_batch", batch: batchN, partial_rows: rows.length })
        break
      }
      const event = await fetchEvent(ref.url, log)
      if (!event) {
        skipped++
        continue
      }
      rows.push(rowFromEvent(ref, event))
    }
    inserted += await insertBatch(rows)
    log({
      step: "batch.done",
      batch: batchN,
      rows: rows.length,
      inserted_total: inserted,
      batch_ms: Date.now() - tBatch,
    })
    if (overDeadline()) {
      bailedAtBatch = batchN
      break
    }
  }
  if (bailedAtBatch !== null) log({ step: "deadline.partial_run", last_batch: bailedAtBatch })

  return {
    listed: refs.length,
    alreadyKnown: known.size,
    inserted,
    skipped,
    unrecognized,
  }
}
