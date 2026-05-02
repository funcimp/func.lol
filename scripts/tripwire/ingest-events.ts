// scripts/tripwire/ingest-events.ts
//
// CLI wrapper around src/lib/tripwire/ingest.ts. The cron route at
// /api/cron/tripwire-stats imports the same library function, so any change
// to ingestion behavior happens once in one place.
//
// Usage:
//   bun run scripts/tripwire/ingest-events.ts
//   bun run scripts/tripwire/ingest-events.ts --batch 100

import { ingestNewEvents } from "@/lib/tripwire/ingest"

const DEFAULT_BATCH = 200

interface Flags {
  batch: number
}

function parseFlags(argv: string[]): Flags {
  const args = argv.slice(2)
  const i = args.indexOf("--batch")
  const raw = i >= 0 ? args[i + 1] : undefined
  const batch = raw ? parseInt(raw, 10) || DEFAULT_BATCH : DEFAULT_BATCH
  return { batch }
}

async function main(): Promise<void> {
  const { batch } = parseFlags(process.argv)
  console.log(`[ingest] batch=${batch}`)

  const result = await ingestNewEvents({
    batchSize: batch,
    onProgress: (msg) => console.log(`[ingest] ${msg}`),
  })

  console.log()
  console.log(`[ingest] listed:        ${result.listed}`)
  console.log(`[ingest] already known: ${result.alreadyKnown}`)
  console.log(`[ingest] inserted:      ${result.inserted}`)
  console.log(`[ingest] skipped:       ${result.skipped}`)
  if (result.unrecognized > 0) {
    console.log(`[ingest] unrecognized:  ${result.unrecognized}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
