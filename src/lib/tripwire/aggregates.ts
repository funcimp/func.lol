// src/lib/tripwire/aggregates.ts
//
// Page-side data loader for the tripwire stats aggregate. Reads the JSON
// the cron uploaded to blob; falls back to the bundled fixture in dev /
// before the first cron has run. Page rendering uses Next.js ISR
// (`export const revalidate = N`) to cache the rendered HTML. This
// loader doesn't need its own cache layer.

import { get } from "@vercel/blob"
import fixture from "@/app/x/tripwire/_fixtures/aggregates.sample.json"
import { STATS_BLOB_KEY, type Aggregates } from "@/lib/tripwire/aggregate-shape"

export async function getAggregates(): Promise<Aggregates> {
  try {
    const file = await get(STATS_BLOB_KEY, { access: "private" })
    if (file && file.statusCode === 200) {
      const text = await new Response(file.stream).text()
      return JSON.parse(text) as Aggregates
    }
  } catch (err) {
    console.warn("[tripwire/aggregates] blob read failed, falling back to fixture:", err)
  }
  return fixture as Aggregates
}
