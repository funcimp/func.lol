// src/lib/tripwire/aggregates.ts
//
// Page-side data loader for the tripwire stats aggregate. The page render
// path MUST NEVER block on the blob fetch. /x/tripwire was timing out at
// 300s in production because unstable_cache's invalidation semantics
// turn into "the next render does the blob fetch synchronously", and any
// hiccup on that fetch took the whole page down.
//
// Pattern instead: explicit module-level memory cache plus after() to
// schedule the refresh outside the response path.
//
// - First render on a fresh Fluid Compute instance: serve the bundled
//   fixture (so we have something to render NOW) and queue an async
//   refresh that populates the cache.
// - Subsequent renders within STALE_AFTER_MS: return cached data
//   instantly. No fetches.
// - Renders after STALE_AFTER_MS: serve the still-cached data and queue
//   an async refresh. Stale-while-revalidate.
//
// Net result: page renders are bounded by JSX work, never by a blob
// fetch. The freshness floor is "what was in the blob the last time
// after() flushed" — bounded above by ~5 min of staleness per instance
// after the cron writes a new blob.

import { get } from "@vercel/blob"
import { after } from "next/server"
import fixture from "@/app/x/tripwire/_fixtures/aggregates.sample.json"
import { streamToText } from "@/lib/blob-stream"
import { STATS_BLOB_KEY, type Aggregates } from "@/lib/tripwire/aggregate-shape"

const STALE_AFTER_MS = 5 * 60 * 1000

interface CachedAggregates {
  data: Aggregates
  fetchedAt: number
}

let cache: CachedAggregates | null = null
let inflight: Promise<void> | null = null

async function fetchOnce(): Promise<Aggregates | null> {
  try {
    const file = await get(STATS_BLOB_KEY, { access: "private" })
    if (file && file.statusCode === 200) {
      const text = await streamToText(file.stream)
      return JSON.parse(text) as Aggregates
    }
  } catch (err) {
    console.warn("[tripwire/aggregates] blob read failed:", err)
  }
  return null
}

function refresh(): Promise<void> {
  if (inflight) return inflight
  inflight = (async () => {
    const data = await fetchOnce()
    if (data) cache = { data, fetchedAt: Date.now() }
  })().finally(() => {
    inflight = null
  })
  return inflight
}

export async function getAggregates(): Promise<Aggregates> {
  if (!cache) {
    after(refresh())
    return fixture as Aggregates
  }
  if (Date.now() - cache.fetchedAt > STALE_AFTER_MS) {
    after(refresh())
  }
  return cache.data
}
