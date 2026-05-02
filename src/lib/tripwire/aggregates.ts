// src/lib/tripwire/aggregates.ts
//
// Page-side data loader. One job: load the analytics blob the cron
// publishes to stats/tripwire-aggregates.json. That's it.
//
// The page caches the rendered HTML via ISR (`export const revalidate`)
// so this fetch happens at most once per region per ISR window. The
// fixture is a fallback for when the blob isn't there yet (first deploy
// before any cron has run, or genuine outage). We do NOT do background
// refresh via after(): in production after() callbacks were holding
// function instances alive at the platform 300s timeout, polluting the
// runtime log with "Vercel Runtime Timeout" entries. Direct fetch in
// the response path is simpler and lets ISR own the caching.

import { get } from "@vercel/blob"
import fixture from "@/app/x/tripwire/_fixtures/aggregates.sample.json"
import { streamToText } from "@/lib/blob-stream"
import { STATS_BLOB_KEY, type Aggregates } from "@/lib/tripwire/aggregate-shape"

export async function getAggregates(): Promise<Aggregates> {
  try {
    const file = await get(STATS_BLOB_KEY, { access: "private" })
    if (file && file.statusCode === 200) {
      const text = await streamToText(file.stream)
      return JSON.parse(text) as Aggregates
    }
  } catch (err) {
    console.warn("[tripwire/aggregates] blob read failed:", err)
  }
  return fixture as Aggregates
}
