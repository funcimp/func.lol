// scripts/tripwire/build-stats.ts
//
// CLI wrapper around src/lib/tripwire/stats.ts. The cron route at
// /api/cron/tripwire-stats calls the same buildAggregates() and
// publishAggregates(), so the daily/hourly path and the ad-hoc local path
// share one implementation.
//
// Output (default): scratch/blob/stats/tripwire-aggregates.json
// --upload also writes to the live blob via publishAggregates().
//
// Usage:
//   bun run scripts/tripwire/build-stats.ts
//   bun run scripts/tripwire/build-stats.ts --upload
//   bun run scripts/tripwire/build-stats.ts --top-paths 50

import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import {
  buildAggregates,
  publishAggregates,
  STATS_BLOB_KEY,
  DEFAULT_TOP_PATHS,
} from "@/lib/tripwire/stats"

const STATS_LOCAL_PATH = join(process.cwd(), "scratch", "blob", STATS_BLOB_KEY)

interface Flags {
  upload: boolean
  topPaths: number
}

function parseFlags(argv: string[]): Flags {
  const args = argv.slice(2)
  const upload = args.includes("--upload")
  const idx = args.indexOf("--top-paths")
  const topPaths = idx >= 0
    ? parseInt(args[idx + 1] ?? "0", 10) || DEFAULT_TOP_PATHS
    : DEFAULT_TOP_PATHS
  return { upload, topPaths }
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv)
  console.log(`[build-stats] upload=${flags.upload}, topPaths=${flags.topPaths}`)

  console.log("[build-stats] aggregating from Neon...")
  const aggregates = await buildAggregates(flags.topPaths)

  console.log()
  console.log(`Total events:      ${aggregates.lifetime.totalEvents}`)
  console.log(`Distinct IPs:      ${aggregates.lifetime.distinctIps}`)
  console.log(`Distinct paths:    ${aggregates.lifetime.distinctPaths}`)
  console.log(`Distinct ASNs:     ${aggregates.lifetime.distinctAsns}`)
  console.log(`Earliest:          ${aggregates.lifetime.earliestTs}`)
  console.log(`Latest:            ${aggregates.lifetime.latestTs}`)
  console.log()

  const json = JSON.stringify(aggregates, null, 2)
  await mkdir(dirname(STATS_LOCAL_PATH), { recursive: true })
  await writeFile(STATS_LOCAL_PATH, json, "utf8")
  console.log(`[build-stats] wrote ${STATS_LOCAL_PATH} (${json.length} bytes)`)

  if (flags.upload) {
    await publishAggregates(aggregates)
    console.log(`[build-stats] uploaded to blob at ${STATS_BLOB_KEY}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
