// scripts/tripwire/build-stats.ts
//
// Aggregator for the tripwire stats page. Reads bronze events from the
// events/ blob prefix (mirrored locally), enriches IPs with ASN data via
// the bundled GeoLite2-ASN.mmdb, and emits a flat JSON aggregate that the
// stats page renders.
//
// Output (default): scratch/blob/stats/tripwire-aggregates.json
// Optional: pass --upload to also write to the live blob at the same path.
//
// Usage:
//   bun run scripts/tripwire/build-stats.ts                   # local only
//   bun run scripts/tripwire/build-stats.ts --upload          # local + blob
//   bun run scripts/tripwire/build-stats.ts --top-paths 50    # cap topPaths length
//
// The aggregator is intentionally simple: read everything, aggregate in
// memory, write one JSON file. At hobby-site scale (hundreds of events,
// growing slowly) this is well under build/cron time budgets. Switch to
// streaming or Postgres if/when volume justifies.

import { list, get, put } from "@vercel/blob"
import { Reader, ReaderModel, type Asn } from "@maxmind/geoip2-node"
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

const ROOT = join(process.cwd(), "scratch", "blob")
const EVENTS_DIR = join(ROOT, "events")
const STATS_LOCAL_PATH = join(ROOT, "stats", "tripwire-aggregates.json")
const STATS_BLOB_KEY = "stats/tripwire-aggregates.json"
const ASN_DB_PATH = join(process.cwd(), "data", "GeoLite2-ASN.mmdb")
const DEFAULT_TOP_PATHS = 100

interface TripwireEvent {
  event: "tripwire.hit" | "tripwire.throttled"
  req_id?: string
  ts: string
  path: string
  pattern: string
  ip: string
  query?: string
  category?: string
  bomb?: string
  ua_raw?: string
  ua_family?: string
}

interface Aggregates {
  generatedAt: string
  lifetime: {
    totalEvents: number
    earliestTs: string
    latestTs: string
    daysSinceFirst: number
    distinctIps: number
    distinctPaths: number
    distinctAsns: number
  }
  byCategory: Array<{ category: string; count: number }>
  byUaFamily: Array<{ ua: string; count: number }>
  byDay: Array<{ date: string; count: number }>
  topPaths: Array<{ path: string; count: number; category?: string }>
  byAsn: Array<{ asn: string; name: string; count: number }>
}

interface Flags {
  upload: boolean
  topPaths: number
}

function parseFlags(argv: string[]): Flags {
  const args = argv.slice(2)
  const upload = args.includes("--upload")
  const topPathsIdx = args.indexOf("--top-paths")
  const topPaths = topPathsIdx >= 0
    ? parseInt(args[topPathsIdx + 1] ?? "0", 10) || DEFAULT_TOP_PATHS
    : DEFAULT_TOP_PATHS
  return { upload, topPaths }
}

async function localSize(path: string): Promise<number | null> {
  try { return (await stat(path)).size } catch { return null }
}

// Mirror the events/ blob prefix to scratch/blob/events/. Skips files that
// already exist locally with matching size.
async function mirrorEvents(): Promise<{ downloaded: number; skipped: number }> {
  let cursor: string | undefined
  let downloaded = 0
  let skipped = 0
  do {
    const page = await list({ prefix: "events/", cursor })
    for (const blob of page.blobs) {
      const localPath = join(ROOT, blob.pathname)
      if ((await localSize(localPath)) === blob.size) { skipped++; continue }
      const file = await get(blob.url, { access: "private" })
      if (!file || file.statusCode !== 200) continue
      const buf = Buffer.from(await new Response(file.stream).arrayBuffer())
      await mkdir(dirname(localPath), { recursive: true })
      await writeFile(localPath, buf)
      downloaded++
    }
    cursor = page.cursor
  } while (cursor)
  return { downloaded, skipped }
}

async function readAllEvents(): Promise<TripwireEvent[]> {
  const out: TripwireEvent[] = []
  let dateDirs: string[]
  try { dateDirs = await readdir(EVENTS_DIR) } catch { return out }
  for (const dir of dateDirs) {
    const dirPath = join(EVENTS_DIR, dir)
    let files: string[]
    try { files = await readdir(dirPath) } catch { continue }
    for (const f of files) {
      if (!f.endsWith(".json")) continue
      try {
        const text = await readFile(join(dirPath, f), "utf8")
        out.push(JSON.parse(text) as TripwireEvent)
      } catch { /* skip malformed */ }
    }
  }
  return out
}

async function aggregate(events: TripwireEvent[], reader: ReaderModel, topPathsLimit: number): Promise<Aggregates> {
  if (events.length === 0) {
    throw new Error("no events found — mirror produced an empty events/ tree")
  }

  const byCategory = new Map<string, number>()
  const byUaFamily = new Map<string, number>()
  const byDay = new Map<string, number>()
  const byPath = new Map<string, { count: number; category?: string }>()
  const byAsn = new Map<string, { name: string; count: number }>()
  const ips = new Set<string>()
  const asnsSeen = new Set<string>()
  let earliestTs = events[0].ts
  let latestTs = events[0].ts

  for (const e of events) {
    if (e.ts < earliestTs) earliestTs = e.ts
    if (e.ts > latestTs) latestTs = e.ts
    if (e.category) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + 1)
    const ua = e.ua_family ?? "unknown"
    byUaFamily.set(ua, (byUaFamily.get(ua) ?? 0) + 1)
    const day = e.ts.slice(0, 10)
    byDay.set(day, (byDay.get(day) ?? 0) + 1)
    const pathEntry = byPath.get(e.path) ?? { count: 0, category: e.category }
    pathEntry.count++
    byPath.set(e.path, pathEntry)
    if (e.ip) {
      ips.add(e.ip)
      let lookup: Asn | null = null
      try { lookup = reader.asn(e.ip) } catch { /* unknown / private */ }
      if (lookup?.autonomousSystemNumber) {
        const asn = `AS${lookup.autonomousSystemNumber}`
        const name = lookup.autonomousSystemOrganization ?? "Unknown"
        const entry = byAsn.get(asn) ?? { name, count: 0 }
        entry.count++
        byAsn.set(asn, entry)
        asnsSeen.add(asn)
      }
    }
  }

  const earliestDate = new Date(earliestTs)
  const daysSinceFirst = Math.max(1, Math.ceil((Date.now() - earliestDate.getTime()) / 86400000))

  const sortDesc = <T extends { count: number }>(arr: T[]): T[] =>
    arr.sort((a, b) => b.count - a.count)

  return {
    generatedAt: new Date().toISOString(),
    lifetime: {
      totalEvents: events.length,
      earliestTs,
      latestTs,
      daysSinceFirst,
      distinctIps: ips.size,
      distinctPaths: byPath.size,
      distinctAsns: asnsSeen.size,
    },
    byCategory: sortDesc(
      [...byCategory].map(([category, count]) => ({ category, count })),
    ),
    byUaFamily: sortDesc(
      [...byUaFamily].map(([ua, count]) => ({ ua, count })),
    ),
    byDay: [...byDay]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    topPaths: sortDesc(
      [...byPath].map(([path, v]) => ({ path, count: v.count, category: v.category })),
    ).slice(0, topPathsLimit),
    byAsn: sortDesc(
      [...byAsn].map(([asn, v]) => ({ asn, name: v.name, count: v.count })),
    ),
  }
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv)
  console.log(`[build-stats] upload=${flags.upload}, topPaths=${flags.topPaths}`)
  console.log()

  console.log("[build-stats] mirroring events/ blob prefix...")
  const mr = await mirrorEvents()
  console.log(`[build-stats] mirror: ${mr.downloaded} downloaded, ${mr.skipped} skipped`)

  console.log("[build-stats] reading events...")
  const events = await readAllEvents()
  console.log(`[build-stats] read ${events.length} events`)

  console.log(`[build-stats] opening ASN db at ${ASN_DB_PATH}...`)
  const reader = await Reader.open(ASN_DB_PATH)

  console.log("[build-stats] aggregating + enriching...")
  const aggregates = await aggregate(events, reader, flags.topPaths)

  console.log()
  console.log(`Total events:      ${aggregates.lifetime.totalEvents}`)
  console.log(`Distinct IPs:      ${aggregates.lifetime.distinctIps}`)
  console.log(`Distinct paths:    ${aggregates.lifetime.distinctPaths}`)
  console.log(`Distinct ASNs:     ${aggregates.lifetime.distinctAsns}`)
  console.log(`Earliest:          ${aggregates.lifetime.earliestTs}`)
  console.log(`Latest:            ${aggregates.lifetime.latestTs}`)
  console.log()

  const json = JSON.stringify(aggregates, null, 2)

  await mkdir(dirname(STATS_LOCAL_PATH), { recursive: true })
  await writeFile(STATS_LOCAL_PATH, json, "utf8")
  console.log(`[build-stats] wrote ${STATS_LOCAL_PATH} (${json.length} bytes)`)

  if (flags.upload) {
    await put(STATS_BLOB_KEY, json, {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    })
    console.log(`[build-stats] uploaded to blob at ${STATS_BLOB_KEY}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
