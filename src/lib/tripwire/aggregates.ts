// src/lib/tripwire/aggregates.ts
//
// Page-side analytics blob loader. The build-stats cron republishes
// stats/tripwire-aggregates.json every ~15 minutes and calls
// revalidateTag(STATS_BLOB_TAG) right after, so the page-side fetch is
// served from Next's data cache until that exact moment of invalidation.
//
// We also keep a 2-minute module-level singleton in front of the fetch:
// the data cache lives in the regional edge, the singleton lives in the
// running instance. The singleton absorbs bursty page traffic on a warm
// instance without crossing the network at all. Stale data is fine for
// up to 2 minutes — the cron only runs every 15.
//
// On any fetch error we throw — `src/app/x/tripwire/error.tsx` surfaces
// a retry button. We deliberately don't fall back to stale data; a hard
// failure is better than silently lying about freshness.

import { head } from "@vercel/blob"
import {
  STATS_BLOB_KEY,
  STATS_BLOB_TAG,
  type Aggregates,
} from "@/lib/tripwire/aggregate-shape"

const TTL_MS = 2 * 60 * 1000

let cached: { data: Aggregates; fetchedAt: number } | null = null

export async function getAggregates(): Promise<Aggregates> {
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return cached.data
  }
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is not set")

  const meta = await head(STATS_BLOB_KEY)
  const res = await fetch(meta.url, {
    headers: { authorization: `Bearer ${token}` },
    next: { tags: [STATS_BLOB_TAG] },
  })
  if (!res.ok) {
    throw new Error(`blob fetch failed (status ${res.status} ${res.statusText})`)
  }
  const data = (await res.json()) as Aggregates
  cached = { data, fetchedAt: Date.now() }
  return data
}

// Test-only: reset the singleton between cases.
export function _resetAggregatesCacheForTests(): void {
  cached = null
}
