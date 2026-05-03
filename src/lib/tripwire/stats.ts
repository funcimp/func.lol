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

import { put } from "@vercel/blob"
import { Reader, type Asn, type ReaderModel } from "@maxmind/geoip2-node"
import { sql } from "drizzle-orm"
import { getDb } from "@/db"
import { log } from "@/lib/log"
import { ASN_BLOB_KEY, ASN_BLOB_TAG } from "@/lib/tripwire/sync-geoip"
import {
  STATS_BLOB_KEY,
  DEFAULT_TOP_PATHS,
  type Aggregates,
} from "@/lib/tripwire/aggregate-shape"

const slog = log.child({ event: "tripwire.stats" })

// Re-export so existing callers can keep importing from "@/lib/tripwire/stats".
// The page-side loader imports STATS_BLOB_KEY straight from aggregate-shape so
// it never pulls drizzle into the page bundle.
export { STATS_BLOB_KEY, DEFAULT_TOP_PATHS, type Aggregates }

let cachedAsnReader: ReaderModel | null = null

// Token format is `vercel_blob_rw_<storeId>_<rest>`. The SDK does the
// same split internally to construct private blob URLs.
function privateBlobUrl(pathname: string, token: string): string {
  const storeId = token.split("_")[3]
  if (!storeId) {
    throw new Error("could not extract store id from BLOB_READ_WRITE_TOKEN")
  }
  return `https://${storeId}.private.blob.vercel-storage.com/${pathname}`
}

async function getAsnReader(): Promise<ReaderModel> {
  if (cachedAsnReader) {
    slog.debug({ step: "asn.cache_hit" })
    return cachedAsnReader
  }
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is not set")

  // Direct fetch with the bearer token, tagged for the Next.js data cache.
  // tripwire-asn-update calls revalidateTag(ASN_BLOB_TAG) after a fresh put,
  // so we only pay for the 12MB drain when the mmdb actually changed.
  // We bypass @vercel/blob's head() because it goes through the SDK's
  // body-drain pattern that hangs on Bun-on-Vercel.
  const tFetch = Date.now()
  slog.debug({ step: "asn.fetch_start", key: ASN_BLOB_KEY })
  const res = await fetch(privateBlobUrl(ASN_BLOB_KEY, token), {
    headers: { authorization: `Bearer ${token}` },
    next: { tags: [ASN_BLOB_TAG] },
  })
  slog.debug({
    step: "asn.fetch_done",
    elapsed_ms: Date.now() - tFetch,
    status: res.status,
    cache: res.headers.get("x-vercel-cache"),
  })
  if (!res.ok) {
    throw new Error(
      `Failed to fetch ${ASN_BLOB_KEY} (status: ${res.status} ${res.statusText}). ` +
        `Run the tripwire-asn-update cron / sync-geoip-to-blob.ts to populate it.`,
    )
  }

  const tBuf = Date.now()
  slog.debug({ step: "asn.array_buffer_start" })
  const buf = Buffer.from(await res.arrayBuffer())
  slog.debug({ step: "asn.array_buffer_done", elapsed_ms: Date.now() - tBuf, bytes: buf.length })

  const tOpen = Date.now()
  cachedAsnReader = Reader.openBuffer(buf)
  slog.debug({ step: "asn.reader_open_done", elapsed_ms: Date.now() - tOpen })
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

  const tQ1 = Date.now()
  slog.debug({ step: "sql.lifetime.start" })
  const lifetimeResult = await db.execute<LifetimeRow>(sql`
    SELECT
      COUNT(*)::int             AS total_events,
      MIN(ts)::text             AS earliest_ts,
      MAX(ts)::text             AS latest_ts,
      COUNT(DISTINCT ip)::int   AS distinct_ips,
      COUNT(DISTINCT path)::int AS distinct_paths
    FROM tripwire_events
  `)
  slog.debug({ step: "sql.lifetime.done", elapsed_ms: Date.now() - tQ1 })
  const lifetime = lifetimeResult.rows[0]
  if (!lifetime || lifetime.total_events === 0) {
    throw new Error("no events in tripwire_events; run ingest first")
  }

  const tQ2 = Date.now()
  slog.debug({ step: "sql.byCategory.start" })
  const byCategory = await db.execute<CategoryRow>(sql`
    SELECT category, COUNT(*)::int AS count
    FROM tripwire_events
    WHERE category IS NOT NULL
    GROUP BY category
    ORDER BY count DESC, category ASC
  `)
  slog.debug({ step: "sql.byCategory.done", elapsed_ms: Date.now() - tQ2, rows: byCategory.rows.length })

  const tQ3 = Date.now()
  slog.debug({ step: "sql.byUaFamily.start" })
  const byUaFamily = await db.execute<UaRow>(sql`
    SELECT COALESCE(ua_family, 'unknown') AS ua, COUNT(*)::int AS count
    FROM tripwire_events
    GROUP BY ua
    ORDER BY count DESC, ua ASC
  `)
  slog.debug({ step: "sql.byUaFamily.done", elapsed_ms: Date.now() - tQ3, rows: byUaFamily.rows.length })

  const tQ4 = Date.now()
  slog.debug({ step: "sql.byDay.start" })
  const byDay = await db.execute<DayRow>(sql`
    SELECT TO_CHAR(ts AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
           COUNT(*)::int AS count
    FROM tripwire_events
    GROUP BY date
    ORDER BY date ASC
  `)
  slog.debug({ step: "sql.byDay.done", elapsed_ms: Date.now() - tQ4, rows: byDay.rows.length })

  const tQ5 = Date.now()
  slog.debug({ step: "sql.topPaths.start", limit: topPathsLimit })
  const topPaths = await db.execute<PathRow>(sql`
    SELECT path,
           COUNT(*)::int AS count,
           MAX(category) AS category
    FROM tripwire_events
    GROUP BY path
    ORDER BY count DESC, path ASC
    LIMIT ${topPathsLimit}
  `)
  slog.debug({ step: "sql.topPaths.done", elapsed_ms: Date.now() - tQ5, rows: topPaths.rows.length })

  // ASN enrichment at query time: fold each event's IP through the mmdb
  // and roll up. Lifetime.distinctAsns is computed from the rolled-up map
  // rather than from a SQL DISTINCT — the column-stored value is no
  // longer the source of truth for ASN since we stopped writing it during
  // ingest.
  const tQ6 = Date.now()
  slog.debug({ step: "sql.ipCounts.start" })
  const ipCountsResult = await db.execute<IpCountRow>(sql`
    SELECT ip, COUNT(*)::int AS count
    FROM tripwire_events
    WHERE ip IS NOT NULL AND ip <> ''
    GROUP BY ip
  `)
  slog.debug({ step: "sql.ipCounts.done", elapsed_ms: Date.now() - tQ6, rows: ipCountsResult.rows.length })

  const reader = await getAsnReader()

  const tEnrich = Date.now()
  slog.debug({ step: "asn.enrich.start", ips: ipCountsResult.rows.length })
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
  slog.debug({
    step: "asn.enrich.done",
    elapsed_ms: Date.now() - tEnrich,
    asns: byAsn.length,
  })

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
  const body = JSON.stringify(agg, null, 2)
  const t0 = Date.now()
  slog.debug({ step: "publish.put_start", key: STATS_BLOB_KEY, bytes: body.length })
  await put(STATS_BLOB_KEY, body, {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  })
  slog.debug({ step: "publish.put_done", elapsed_ms: Date.now() - t0 })
}
