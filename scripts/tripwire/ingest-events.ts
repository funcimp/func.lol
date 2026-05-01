// scripts/tripwire/ingest-events.ts
//
// Bronze → silver. Lists every event under the events/ blob prefix, skips
// rows already in tripwire_events (PK lookup on filename id), fetches the
// new ones, enriches each IP with ASN data from the bundled
// GeoLite2-ASN.mmdb, and bulk-inserts. ON CONFLICT (id) DO NOTHING is the
// belt to the SELECT's suspenders — the id list could change between the
// dedup query and the insert if another job ran in parallel.
//
// Usage:
//   bun run scripts/tripwire/ingest-events.ts
//   bun run scripts/tripwire/ingest-events.ts --batch 100
//
// Filename shape from src/proxy.ts: events/<YYYY-MM-DD>/<ms>-<id>.json.
// The id is everything after the first hyphen and before .json — covers
// both the new cuid2 form and the older compound ids written by the sync
// tool.

import { list, get } from "@vercel/blob"
import { Reader, type Asn, type ReaderModel } from "@maxmind/geoip2-node"
import { inArray } from "drizzle-orm"
import { join } from "node:path"
import { getDb, schema } from "@/db"
import { isTripwireEvent, type TripwireEvent } from "@/lib/tripwire/patterns"

const ASN_DB_PATH = join(process.cwd(), "data", "GeoLite2-ASN.mmdb")
const DEFAULT_BATCH = 200
const ID_LOOKUP_CHUNK = 1000

interface Flags {
  batch: number
}

function parseFlags(argv: string[]): Flags {
  const args = argv.slice(2)
  const i = args.indexOf("--batch")
  const raw = i >= 0 ? args[i + 1] : undefined
  const batch = raw ? parseInt(raw, 10) || DEFAULT_BATCH : DEFAULT_BATCH
  return { batch }
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

interface AsnLookup {
  asn: string | null
  asnName: string | null
}

function lookupAsn(reader: ReaderModel, ip: string): AsnLookup {
  let result: Asn | null = null
  try {
    result = reader.asn(ip)
  } catch {
    // Private / unrouted / not-in-db — fall through.
  }
  if (!result?.autonomousSystemNumber) return { asn: null, asnName: null }
  return {
    asn: `AS${result.autonomousSystemNumber}`,
    asnName: result.autonomousSystemOrganization ?? null,
  }
}

async function listAllBlobs(): Promise<BlobRef[]> {
  const out: BlobRef[] = []
  let cursor: string | undefined
  do {
    const page = await list({ prefix: "events/", cursor })
    for (const blob of page.blobs) {
      const id = idFromPathname(blob.pathname)
      if (!id) {
        console.warn(`[ingest] skipping unrecognized blob: ${blob.pathname}`)
        continue
      }
      out.push({ pathname: blob.pathname, url: blob.url, id })
    }
    cursor = page.cursor
  } while (cursor)
  return out
}

async function fetchEvent(url: string): Promise<TripwireEvent | null> {
  const file = await get(url, { access: "private" })
  if (!file || file.statusCode !== 200) {
    console.warn(`[ingest] fetch ${url} → ${file?.statusCode ?? "no response"}`)
    return null
  }
  const text = await new Response(file.stream).text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    console.warn(`[ingest] malformed json at ${url}`)
    return null
  }
  if (!isTripwireEvent(parsed)) {
    console.warn(`[ingest] not a tripwire event: ${url}`)
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

async function main(): Promise<void> {
  const { batch } = parseFlags(process.argv)
  console.log(`[ingest] batch=${batch}`)

  console.log(`[ingest] opening ASN db at ${ASN_DB_PATH}`)
  const reader = await Reader.open(ASN_DB_PATH)

  console.log(`[ingest] listing events/ blob prefix...`)
  const refs = await listAllBlobs()
  console.log(`[ingest] ${refs.length} blob events listed`)

  const allIds = refs.map((r) => r.id)
  const known = await existingIds(allIds)
  const todo = refs.filter((r) => !known.has(r.id))
  console.log(`[ingest] ${known.size} already in DB · ${todo.length} new to ingest`)

  let inserted = 0
  let skipped = 0
  for (let i = 0; i < todo.length; i += batch) {
    const slice = todo.slice(i, i + batch)
    const rows: schema.NewTripwireEventRow[] = []
    for (const ref of slice) {
      const event = await fetchEvent(ref.url)
      if (!event) {
        skipped++
        continue
      }
      const asnLookup = lookupAsn(reader, event.ip)
      rows.push(rowFromEvent(ref, event, asnLookup))
    }
    inserted += await insertBatch(rows)
    console.log(`[ingest] batch ${i / batch + 1}: +${rows.length} (running total ${inserted})`)
  }

  console.log()
  console.log(`[ingest] done · inserted ${inserted} · skipped ${skipped}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
