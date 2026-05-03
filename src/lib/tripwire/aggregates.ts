// src/lib/tripwire/aggregates.ts
//
// Page-side analytics blob loader. The build-stats cron republishes
// stats/tripwire-aggregates.json every ~15 minutes. We hold the parsed
// JSON in a module-level singleton with a 2-minute TTL so a warm
// Fluid Compute instance only pays for the blob fetch once per window.
// On TTL expiry the next request triggers a fresh fetch.
//
// On any fetch error we throw — `src/app/x/tripwire/error.tsx` surfaces
// a retry button. We deliberately don't fall back to stale data; a hard
// failure is better than silently lying about freshness.

import { get } from "@vercel/blob"
import { streamToText } from "@/lib/blob-stream"
import { STATS_BLOB_KEY, type Aggregates } from "@/lib/tripwire/aggregate-shape"

const TTL_MS = 2 * 60 * 1000

let cached: { data: Aggregates; fetchedAt: number } | null = null

export async function getAggregates(): Promise<Aggregates> {
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return cached.data
  }
  const file = await get(STATS_BLOB_KEY, { access: "private" })
  if (!file || file.statusCode !== 200) {
    throw new Error(
      `blob get failed (status ${file?.statusCode ?? "no response"})`,
    )
  }
  const text = await streamToText(file.stream)
  const data = JSON.parse(text) as Aggregates
  cached = { data, fetchedAt: Date.now() }
  return data
}

// Test-only: reset the singleton between cases.
export function _resetAggregatesCacheForTests(): void {
  cached = null
}
