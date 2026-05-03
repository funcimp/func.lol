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

import { list, get } from "@vercel/blob"
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

async function listAllBlobs(
  log: (e: IngestLogEvent) => void,
): Promise<{ refs: BlobRef[]; unrecognized: number }> {
  const refs: BlobRef[] = []
  let unrecognized = 0
  let cursor: string | undefined
  let page = 0
  do {
    page++
    const t0 = Date.now()
    ilog.debug({ step: "list.page_start", page, cursor: cursor ?? null })
    const result = await list({ prefix: "events/", cursor })
    ilog.debug({
      step: "list.page_done",
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
  return { refs, unrecognized }
}

async function fetchEvent(
  url: string,
  log: (e: IngestLogEvent) => void,
): Promise<TripwireEvent | null> {
  const t0 = Date.now()
  ilog.debug({ step: "fetch_event.get_start", url })
  const file = await get(url, { access: "private" })
  ilog.debug({
    step: "fetch_event.get_done",
    elapsed_ms: Date.now() - t0,
    status: file?.statusCode ?? null,
  })
  if (!file || file.statusCode !== 200) {
    log({ step: "fetch_event.bad_status", url, statusCode: file?.statusCode ?? null })
    return null
  }
  const t1 = Date.now()
  const text = await new Response(file.stream).text()
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
