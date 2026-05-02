// src/lib/tripwire/stats.ts
//
// One job: read the current state of the DB, look up ASN data for the
// distinct IPs we have, build the analytics JSON, write it to blob.
// That's it. The page reads that blob and renders it.
//
// ASN enrichment happens here at query time, not at ingest, so refreshing
// the ASN db (via tripwire-asn-update cron) is independent of ingest and
// the next build-stats run picks up the new mapping automatically. The
// reader is cached at module level so warm Fluid Compute instances reuse
// it across cron invocations and only the first cold instance pays the
// ~10MB blob fetch.

import { get, put } from "@vercel/blob"
import { Reader, type Asn, type ReaderModel } from "@maxmind/geoip2-node"
import { sql } from "drizzle-orm"
import { getDb } from "@/db"
import { streamToBuffer } from "@/lib/blob-stream"
import {
  STATS_BLOB_KEY,
  DEFAULT_TOP_PATHS,
  type Aggregates,
} from "@/lib/tripwire/aggregate-shape"

const ASN_BLOB_KEY = "geoip/GeoLite2-ASN.mmdb"

// Re-export so existing callers can keep importing from "@/lib/tripwire/stats".
// The page-side loader imports STATS_BLOB_KEY straight from aggregate-shape so
// it never pulls drizzle into the page bundle.
export { STATS_BLOB_KEY, DEFAULT_TOP_PATHS, type Aggregates }

let cachedAsnReader: ReaderModel | null = null

async function getAsnReader(): Promise<ReaderModel> {
  if (cachedAsnReader) return cachedAsnReader
  const file = await get(ASN_BLOB_KEY, { access: "private" })
  if (!file || file.statusCode !== 200) {
    throw new Error(
      `Failed to fetch ${ASN_BLOB_KEY} from blob (status: ${file?.statusCode ?? "no response"}). ` +
        `Run the tripwire-asn-update cron / sync-geoip-to-blob.ts to populate it.`,
    )
  }
  const buf = await streamToBuffer(file.stream)
  cachedAsnReader = Reader.openBuffer(buf)
  return cachedAsnReader
}

interface AsnLookup {
  asn: string
  name: string
}

function lookupAsn(reader: ReaderModel, ip: string): AsnLookup | null {
  let result: Asn | null = null
  try {
    result = reader.asn(ip)
  } catch {
    // Private / unrouted / not-in-db.
  }
  if (!result?.autonomousSystemNumber) return null
  return {
    asn: `AS${result.autonomousSystemNumber}`,
    name: result.autonomousSystemOrganization ?? "Unknown",
  }
}

type LifetimeRow = {
  total_events: number
  earliest_ts: string
  latest_ts: string
  distinct_ips: number
  distinct_paths: number
} & Record<string, unknown>

type CategoryRow = { category: string; count: number } & Record<string, unknown>
type UaRow = { ua: string; count: number } & Record<string, unknown>
type DayRow = { date: string; count: number } & Record<string, unknown>
type PathRow = { path: string; count: number; category: string | null } & Record<string, unknown>
type IpCountRow = { ip: string; count: number } & Record<string, unknown>

export async function buildAggregates(
  topPathsLimit: number = DEFAULT_TOP_PATHS,
): Promise<Aggregates> {
  const db = getDb()

  const lifetimeResult = await db.execute<LifetimeRow>(sql`
    SELECT
      COUNT(*)::int             AS total_events,
      MIN(ts)::text             AS earliest_ts,
      MAX(ts)::text             AS latest_ts,
      COUNT(DISTINCT ip)::int   AS distinct_ips,
      COUNT(DISTINCT path)::int AS distinct_paths
    FROM tripwire_events
  `)
  const lifetime = lifetimeResult.rows[0]
  if (!lifetime || lifetime.total_events === 0) {
    throw new Error("no events in tripwire_events; run ingest first")
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

  // ASN enrichment at query time: fold each event's IP through the mmdb
  // and roll up. Lifetime.distinctAsns is computed from the rolled-up map
  // rather than from a SQL DISTINCT — the column-stored value is no
  // longer the source of truth for ASN since we stopped writing it during
  // ingest.
  const ipCountsResult = await db.execute<IpCountRow>(sql`
    SELECT ip, COUNT(*)::int AS count
    FROM tripwire_events
    WHERE ip IS NOT NULL AND ip <> ''
    GROUP BY ip
  `)
  const reader = await getAsnReader()
  const asnTotals = new Map<string, { name: string; count: number }>()
  for (const row of ipCountsResult.rows) {
    const lookup = lookupAsn(reader, row.ip)
    if (!lookup) continue
    const entry = asnTotals.get(lookup.asn) ?? { name: lookup.name, count: 0 }
    entry.count += row.count
    asnTotals.set(lookup.asn, entry)
  }
  const byAsn = [...asnTotals.entries()]
    .map(([asn, v]) => ({ asn, name: v.name, count: v.count }))
    .sort((a, b) => (b.count - a.count) || a.asn.localeCompare(b.asn))

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
      distinctAsns: byAsn.length,
    },
    byCategory: byCategory.rows.map((r) => ({ category: r.category, count: r.count })),
    byUaFamily: byUaFamily.rows.map((r) => ({ ua: r.ua, count: r.count })),
    byDay: byDay.rows.map((r) => ({ date: r.date, count: r.count })),
    topPaths: topPaths.rows.map((r) => ({
      path: r.path,
      count: r.count,
      category: r.category ?? undefined,
    })),
    byAsn,
  }
}

export async function publishAggregates(agg: Aggregates): Promise<void> {
  await put(STATS_BLOB_KEY, JSON.stringify(agg, null, 2), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  })
}
