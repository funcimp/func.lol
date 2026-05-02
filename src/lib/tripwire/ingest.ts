// src/lib/tripwire/ingest.ts
//
// Bronze → silver. Lists every event under the events/ blob prefix, skips
// ids already in tripwire_events (PK lookup against the candidate id list),
// fetches the new ones, enriches each IP with ASN data from
// GeoLite2-ASN.mmdb, and bulk-inserts. ON CONFLICT (id) DO NOTHING is the
// belt to the SELECT's suspenders. The id list could change between the
// dedup query and the insert if another job ran in parallel.
//
// Filename shape from src/proxy.ts: events/<YYYY-MM-DD>/<ms>-<id>.json. The
// id is everything after the first hyphen and before .json, which covers
// both the new cuid2 form and the older compound ids written by the sync
// tool.
//
// The ASN db lives in blob (geoip/GeoLite2-ASN.mmdb), not in the deploy
// artifact. Refresh it any time with `bun run scripts/tripwire/sync-geoip-
// to-blob.ts`; no redeploy needed. The reader is cached at module level
// so warm Fluid Compute instances reuse it across cron invocations and
// only the first cold instance pays the ~10MB blob fetch.
//
// Pure library: no console.log, no process.exit. Callers (the CLI script
// and the cron route) decide how to log and surface results.

import { list, get } from "@vercel/blob"
import { Reader, type Asn, type ReaderModel } from "@maxmind/geoip2-node"
import { inArray } from "drizzle-orm"
import { getDb, schema } from "@/db"
import { streamToBuffer, streamToText } from "@/lib/blob-stream"
import { isTripwireEvent, type TripwireEvent } from "@/lib/tripwire/patterns"

const ASN_BLOB_KEY = "geoip/GeoLite2-ASN.mmdb"
const DEFAULT_BATCH = 200
const ID_LOOKUP_CHUNK = 1000

let cachedAsnReader: ReaderModel | null = null

// Structured-log shape. Callers (cron route + CLI scripts) get a single
// JSON line per emit, ready to drop straight into Vercel's runtime log
// indexer. Match the pattern src/proxy.ts already uses for
// tripwire.hit / tripwire.throttled events.
export interface IngestLogEvent {
  step: string
  [field: string]: unknown
}

async function getAsnReader(log: (e: IngestLogEvent) => void): Promise<ReaderModel> {
  if (cachedAsnReader) {
    log({ step: "asn_reader.cached_hit" })
    return cachedAsnReader
  }
  log({ step: "asn_reader.fetch_start" })
  const t0 = Date.now()
  const file = await get(ASN_BLOB_KEY, { access: "private" })
  if (!file || file.statusCode !== 200) {
    throw new Error(
      `Failed to fetch ${ASN_BLOB_KEY} from blob (status: ${file?.statusCode ?? "no response"}). ` +
        `Run scripts/tripwire/sync-geoip-to-blob.ts to populate it.`,
    )
  }
  const t1 = Date.now()
  log({ step: "asn_reader.fetch_done", get_ms: t1 - t0 })
  const buf = await streamToBuffer(file.stream)
  const t2 = Date.now()
  log({ step: "asn_reader.drain_done", drain_ms: t2 - t1, bytes: buf.length })
  cachedAsnReader = Reader.openBuffer(buf)
  log({ step: "asn_reader.open_done", open_ms: Date.now() - t2 })
  return cachedAsnReader
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

interface AsnLookup {
  asn: string | null
  asnName: string | null
}

// events/2026-04-30/1777563007310-kj5ynyxqlmw81z9dlc8zpqxf.json
//                                 ^^^^^^^^^^^^^^^^^^^^^^^^
function idFromPathname(pathname: string): string | null {
  const match = pathname.match(/\/(\d+)-(.+)\.json$/)
  return match ? match[2] : null
}

function lookupAsn(reader: ReaderModel, ip: string): AsnLookup {
  let result: Asn | null = null
  try {
    result = reader.asn(ip)
  } catch {
    // Private / unrouted / not-in-db. Fall through.
  }
  if (!result?.autonomousSystemNumber) return { asn: null, asnName: null }
  return {
    asn: `AS${result.autonomousSystemNumber}`,
    asnName: result.autonomousSystemOrganization ?? null,
  }
}

async function listAllBlobs(log: (e: IngestLogEvent) => void): Promise<{ refs: BlobRef[]; unrecognized: number }> {
  const refs: BlobRef[] = []
  let unrecognized = 0
  let cursor: string | undefined
  do {
    const page = await list({ prefix: "events/", cursor })
    for (const blob of page.blobs) {
      const id = idFromPathname(blob.pathname)
      if (!id) {
        unrecognized++
        log({ step: "list.unrecognized_blob", pathname: blob.pathname })
        continue
      }
      refs.push({ pathname: blob.pathname, url: blob.url, id })
    }
    cursor = page.cursor
  } while (cursor)
  return { refs, unrecognized }
}

async function fetchEvent(url: string, log: (e: IngestLogEvent) => void): Promise<TripwireEvent | null> {
  const file = await get(url, { access: "private" })
  if (!file || file.statusCode !== 200) {
    log({ step: "fetch_event.bad_status", url, statusCode: file?.statusCode ?? null })
    return null
  }
  const text = await streamToText(file.stream)
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

function rowFromEvent(
  ref: BlobRef,
  event: TripwireEvent,
  asnLookup: AsnLookup,
): schema.NewTripwireEventRow {
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
    asn: asnLookup.asn,
    asnName: asnLookup.asnName,
    blobPathname: ref.pathname,
  }
}

async function existingIds(ids: string[]): Promise<Set<string>> {
  const out = new Set<string>()
  if (ids.length === 0) return out
  const db = getDb()
  for (let i = 0; i < ids.length; i += ID_LOOKUP_CHUNK) {
    const chunk = ids.slice(i, i + ID_LOOKUP_CHUNK)
    const rows = await db
      .select({ id: schema.tripwireEvents.id })
      .from(schema.tripwireEvents)
      .where(inArray(schema.tripwireEvents.id, chunk))
    for (const r of rows) out.add(r.id)
  }
  return out
}

async function insertBatch(rows: schema.NewTripwireEventRow[]): Promise<number> {
  if (rows.length === 0) return 0
  const db = getDb()
  await db.insert(schema.tripwireEvents).values(rows).onConflictDoNothing()
  return rows.length
}

export async function ingestNewEvents(opts: IngestOptions = {}): Promise<IngestResult> {
  const batchSize = opts.batchSize ?? DEFAULT_BATCH
  const log = opts.onProgress ?? (() => {})
  const deadlineMs = opts.deadlineMs ?? Number.POSITIVE_INFINITY
  const overDeadline = () => Date.now() >= deadlineMs

  const reader = await getAsnReader(log)

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
      rows.push(rowFromEvent(ref, event, lookupAsn(reader, event.ip)))
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
