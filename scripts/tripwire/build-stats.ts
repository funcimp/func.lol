// scripts/tripwire/build-stats.ts
//
// Silver → gold. SQL aggregations over tripwire_events; JSON output for
// the stats page. Run scripts/tripwire/ingest-events.ts first to bring
// the DB up to date with the events/ blob prefix.
//
// Output (default): scratch/blob/stats/tripwire-aggregates.json
// Optional: pass --upload to also write to the live blob at the same path.
//
// Usage:
//   bun run scripts/tripwire/build-stats.ts                   # local only
//   bun run scripts/tripwire/build-stats.ts --upload          # local + blob
//   bun run scripts/tripwire/build-stats.ts --top-paths 50    # cap topPaths length

import { put } from "@vercel/blob"
import { sql } from "drizzle-orm"
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { getDb } from "@/db"

const ROOT = join(process.cwd(), "scratch", "blob")
const STATS_LOCAL_PATH = join(ROOT, "stats", "tripwire-aggregates.json")
const STATS_BLOB_KEY = "stats/tripwire-aggregates.json"
const DEFAULT_TOP_PATHS = 100

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
  const idx = args.indexOf("--top-paths")
  const topPaths = idx >= 0
    ? parseInt(args[idx + 1] ?? "0", 10) || DEFAULT_TOP_PATHS
    : DEFAULT_TOP_PATHS
  return { upload, topPaths }
}

type LifetimeRow = {
  total_events: number
  earliest_ts: string
  latest_ts: string
  distinct_ips: number
  distinct_paths: number
  distinct_asns: number
} & Record<string, unknown>

type CategoryRow = { category: string; count: number } & Record<string, unknown>
type UaRow = { ua: string; count: number } & Record<string, unknown>
type DayRow = { date: string; count: number } & Record<string, unknown>
type PathRow = { path: string; count: number; category: string | null } & Record<string, unknown>
type AsnRow = { asn: string; name: string; count: number } & Record<string, unknown>

async function aggregate(topPathsLimit: number): Promise<Aggregates> {
  const db = getDb()

  const lifetimeResult = await db.execute<LifetimeRow>(sql`
    SELECT
      COUNT(*)::int                 AS total_events,
      MIN(ts)::text                 AS earliest_ts,
      MAX(ts)::text                 AS latest_ts,
      COUNT(DISTINCT ip)::int       AS distinct_ips,
      COUNT(DISTINCT path)::int     AS distinct_paths,
      COUNT(DISTINCT asn)::int      AS distinct_asns
    FROM tripwire_events
  `)
  const lifetime = lifetimeResult.rows[0]
  if (!lifetime || lifetime.total_events === 0) {
    throw new Error("no events in tripwire_events — run ingest-events.ts first")
  }

  const byCategory = await db.execute<CategoryRow>(sql`
    SELECT category, COUNT(*)::int AS count
    FROM tripwire_events
    WHERE category IS NOT NULL
    GROUP BY category
    ORDER BY count DESC, category ASC
  `)

  const byUaFamily = await db.execute<UaRow>(sql`
    SELECT COALESCE(ua_family, 'unknown') AS ua, COUNT(*)::int AS count
    FROM tripwire_events
    GROUP BY ua
    ORDER BY count DESC, ua ASC
  `)

  const byDay = await db.execute<DayRow>(sql`
    SELECT TO_CHAR(ts AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
           COUNT(*)::int AS count
    FROM tripwire_events
    GROUP BY date
    ORDER BY date ASC
  `)

  const topPaths = await db.execute<PathRow>(sql`
    SELECT path,
           COUNT(*)::int AS count,
           MAX(category) AS category
    FROM tripwire_events
    GROUP BY path
    ORDER BY count DESC, path ASC
    LIMIT ${topPathsLimit}
  `)

  const byAsn = await db.execute<AsnRow>(sql`
    SELECT asn,
           COALESCE(MAX(asn_name), 'Unknown') AS name,
           COUNT(*)::int AS count
    FROM tripwire_events
    WHERE asn IS NOT NULL
    GROUP BY asn
    ORDER BY count DESC, asn ASC
  `)

  const earliestDate = new Date(lifetime.earliest_ts)
  const daysSinceFirst = Math.max(
    1,
    Math.ceil((Date.now() - earliestDate.getTime()) / 86400000),
  )

  return {
    generatedAt: new Date().toISOString(),
    lifetime: {
      totalEvents: lifetime.total_events,
      earliestTs: new Date(lifetime.earliest_ts).toISOString(),
      latestTs: new Date(lifetime.latest_ts).toISOString(),
      daysSinceFirst,
      distinctIps: lifetime.distinct_ips,
      distinctPaths: lifetime.distinct_paths,
      distinctAsns: lifetime.distinct_asns,
    },
    byCategory: byCategory.rows.map((r) => ({ category: r.category, count: r.count })),
    byUaFamily: byUaFamily.rows.map((r) => ({ ua: r.ua, count: r.count })),
    byDay: byDay.rows.map((r) => ({ date: r.date, count: r.count })),
    topPaths: topPaths.rows.map((r) => ({
      path: r.path,
      count: r.count,
      category: r.category ?? undefined,
    })),
    byAsn: byAsn.rows.map((r) => ({ asn: r.asn, name: r.name, count: r.count })),
  }
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv)
  console.log(`[build-stats] upload=${flags.upload}, topPaths=${flags.topPaths}`)

  console.log("[build-stats] aggregating from Neon...")
  const aggregates = await aggregate(flags.topPaths)

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
