// src/lib/tripwire/ingest.ts
//
// Bronze → silver. Lists every event under the events/ blob prefix, skips
// ids already in tripwire_events (PK lookup against the candidate id list),
// fetches the new ones, enriches each IP with ASN data from the bundled
// GeoLite2-ASN.mmdb, and bulk-inserts. ON CONFLICT (id) DO NOTHING is the
// belt to the SELECT's suspenders. The id list could change between the
// dedup query and the insert if another job ran in parallel.
//
// Filename shape from src/proxy.ts: events/<YYYY-MM-DD>/<ms>-<id>.json. The
// id is everything after the first hyphen and before .json, which covers
// both the new cuid2 form and the older compound ids written by the sync
// tool.
//
// Pure library: no console.log, no process.exit. Callers (the CLI script
// and the cron route) decide how to log and surface results.

import { list, get } from "@vercel/blob"
import { Reader, type Asn, type ReaderModel } from "@maxmind/geoip2-node"
import { inArray } from "drizzle-orm"
import { join } from "node:path"
import { getDb, schema } from "@/db"
import { isTripwireEvent, type TripwireEvent } from "@/lib/tripwire/patterns"

const ASN_DB_PATH = join(process.cwd(), "data", "GeoLite2-ASN.mmdb")
const DEFAULT_BATCH = 200
const ID_LOOKUP_CHUNK = 1000

export interface IngestOptions {
  batchSize?: number
  asnDbPath?: string
  onProgress?: (msg: string) => void
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

async function listAllBlobs(log: (msg: string) => void): Promise<{ refs: BlobRef[]; unrecognized: number }> {
  const refs: BlobRef[] = []
  let unrecognized = 0
  let cursor: string | undefined
  do {
    const page = await list({ prefix: "events/", cursor })
    for (const blob of page.blobs) {
      const id = idFromPathname(blob.pathname)
      if (!id) {
        unrecognized++
        log(`skipping unrecognized blob: ${blob.pathname}`)
        continue
      }
      refs.push({ pathname: blob.pathname, url: blob.url, id })
    }
    cursor = page.cursor
  } while (cursor)
  return { refs, unrecognized }
}

async function fetchEvent(url: string, log: (msg: string) => void): Promise<TripwireEvent | null> {
  const file = await get(url, { access: "private" })
  if (!file || file.statusCode !== 200) {
    log(`fetch ${url} → ${file?.statusCode ?? "no response"}`)
    return null
  }
  const text = await new Response(file.stream).text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    log(`malformed json at ${url}`)
    return null
  }
  if (!isTripwireEvent(parsed)) {
    log(`not a tripwire event: ${url}`)
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
  const asnDbPath = opts.asnDbPath ?? ASN_DB_PATH
  const log = opts.onProgress ?? (() => {})

  const reader = await Reader.open(asnDbPath)
  const { refs, unrecognized } = await listAllBlobs(log)
  const allIds = refs.map((r) => r.id)
  const known = await existingIds(allIds)
  const todo = refs.filter((r) => !known.has(r.id))

  let inserted = 0
  let skipped = 0
  for (let i = 0; i < todo.length; i += batchSize) {
    const slice = todo.slice(i, i + batchSize)
    const rows: schema.NewTripwireEventRow[] = []
    for (const ref of slice) {
      const event = await fetchEvent(ref.url, log)
      if (!event) {
        skipped++
        continue
      }
      rows.push(rowFromEvent(ref, event, lookupAsn(reader, event.ip)))
    }
    inserted += await insertBatch(rows)
    log(`batch ${Math.floor(i / batchSize) + 1}: +${rows.length} (running total ${inserted})`)
  }

  return {
    listed: refs.length,
    alreadyKnown: known.size,
    inserted,
    skipped,
    unrecognized,
  }
}
