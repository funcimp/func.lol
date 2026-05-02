// src/lib/tripwire/aggregates.ts
//
// Page-side data loader for the tripwire stats aggregate. Reads the JSON
// the cron uploaded to blob; falls back to the bundled fixture if the
// blob isn't there yet (dev or first deploy before the cron has run).
//
// Wrapped in unstable_cache so the blob fetch is explicitly cached for
// 5 minutes. Page-level `revalidate = N` should give us ISR for free,
// but in practice /x/tripwire showed up as `ƒ` (dynamic) in the route
// table, which meant every request was re-rendering and re-fetching the
// blob. Caching at the data layer makes the cadence explicit and decouples
// it from Next.js's auto-detection of "is this page dynamic".

import { get } from "@vercel/blob"
import { unstable_cache } from "next/cache"
import fixture from "@/app/x/tripwire/_fixtures/aggregates.sample.json"
import { STATS_BLOB_KEY, type Aggregates } from "@/lib/tripwire/aggregate-shape"

const CACHE_SECONDS = 300

const fetchAggregates = unstable_cache(
  async (): Promise<Aggregates | null> => {
    try {
      const file = await get(STATS_BLOB_KEY, { access: "private" })
      if (file && file.statusCode === 200) {
        const text = await new Response(file.stream).text()
        return JSON.parse(text) as Aggregates
      }
    } catch (err) {
      console.warn("[tripwire/aggregates] blob read failed:", err)
    }
    return null
  },
  ["tripwire-aggregates"],
  { revalidate: CACHE_SECONDS, tags: ["tripwire-aggregates"] },
)

export async function getAggregates(): Promise<Aggregates> {
  const fresh = await fetchAggregates()
  return fresh ?? (fixture as Aggregates)
}
