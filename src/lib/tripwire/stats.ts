// src/lib/tripwire/stats.ts
//
// Silver → gold. SQL aggregations over tripwire_events plus the JSON
// shape the stats page consumes. Pure library (no console.log,
// no process.exit) so the cron route and the CLI script can both call it.

import { put } from "@vercel/blob"
import { sql } from "drizzle-orm"
import { getDb } from "@/db"
import {
  STATS_BLOB_KEY,
  DEFAULT_TOP_PATHS,
  type Aggregates,
} from "@/lib/tripwire/aggregate-shape"

// Re-export so existing callers can keep importing from "@/lib/tripwire/stats".
// The page-side loader imports STATS_BLOB_KEY straight from aggregate-shape so
// it never pulls drizzle into the page bundle.
export { STATS_BLOB_KEY, DEFAULT_TOP_PATHS, type Aggregates }

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

export async function buildAggregates(topPathsLimit: number = DEFAULT_TOP_PATHS): Promise<Aggregates> {
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

export async function publishAggregates(agg: Aggregates): Promise<void> {
  await put(STATS_BLOB_KEY, JSON.stringify(agg, null, 2), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  })
}
