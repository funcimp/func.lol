// src/lib/tripwire/aggregates.ts
//
// Page-side data loader. One job: fetch stats/tripwire-aggregates.json
// from blob and return it. The cron writes this blob on a schedule;
// it is always there in production. If the fetch fails, that's a real
// error and we let it propagate so it shows up in logs and a Suspense
// error boundary can surface it.

import { get } from "@vercel/blob"
import { streamToText } from "@/lib/blob-stream"
import { STATS_BLOB_KEY, type Aggregates } from "@/lib/tripwire/aggregate-shape"

export async function getAggregates(): Promise<Aggregates> {
  const file = await get(STATS_BLOB_KEY, { access: "private" })
  if (!file || file.statusCode !== 200) {
    throw new Error(
      `Failed to fetch ${STATS_BLOB_KEY} (status: ${file?.statusCode ?? "no response"})`,
    )
  }
  const text = await streamToText(file.stream)
  return JSON.parse(text) as Aggregates
}
