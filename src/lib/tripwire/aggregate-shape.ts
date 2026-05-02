// src/lib/tripwire/aggregate-shape.ts
//
// Pure types/constants shared between the page-side loader (aggregates.ts)
// and the cron-side aggregator (stats.ts). Kept dep-free so importing the
// blob key on the page does not transitively pull drizzle-orm + the Neon
// driver into the /x/tripwire serverless bundle. That cold-start mattered
// in practice — Tripwire's first hit was visibly slow vs Prime Moments
// before this split.

export const STATS_BLOB_KEY = "stats/tripwire-aggregates.json"
export const DEFAULT_TOP_PATHS = 100

export interface Aggregates {
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
