// scripts/sync-tripwire.ts
//
// Idempotent diagnose-and-backfill tool for the tripwire bronze layer.
//
// Five capabilities:
//   1. Mirror existing blob data locally (reuses scripts/mirror-blob.ts)
//   2. Filter a Vercel log export to tripwire events
//   3. Compute the gap between log events and what's in blob storage
//   4. Optionally backfill the missing events to blob
//   5. Idempotent — re-runs against the same input are no-ops
//
// Usage:
//   bun run sync-tripwire <log-export.json>                          # diff only
//   bun run sync-tripwire <log-export.json> --upload                # diff + backfill
//   bun run sync-tripwire <log-export.json> --since 7d              # custom min date
//   bun run sync-tripwire <log-export.json> --since 2026-04-20      # absolute date
//
// --since defaults to 7d (matches Vercel's log retention window). Events older
// than the threshold are skipped. Bounds the work for future periodic runs.
//
// Idempotency:
//   * Backfill filenames are deterministic: tripwire/events/<YYYY-MM-DD>/
//     <event-ts-ms>-bf-<sha1(eventJSON, 6)>.json. Same event in → same file
//     out. The "bf" segment distinguishes backfilled from live writes.
//   * allowOverwrite: true on writes makes re-uploads safe at the storage
//     layer.
//   * The blob ts Set is built from local mirror contents AFTER mirroring,
//     so newly-backfilled events are picked up on subsequent runs and never
//     re-uploaded.

import { put } from "@vercel/blob"
import { createHash } from "node:crypto"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { mirrorBlob } from "./mirror-blob"

const ROOT = join(process.cwd(), "scratch", "blob")

interface TripwireEvent {
  event: "tripwire.hit" | "tripwire.throttled"
  ts: string
  path: string
  pattern: string
  ip: string
  query?: string
  category?: string
  bomb?: string
  ua_raw?: string
  ua_family?: string
}

interface LogEntry {
  message?: string
  type?: string
  level?: string
}

interface Flags {
  logPath: string
  upload: boolean
  since: Date
  sinceRaw: string
}

function parseSince(input: string): Date {
  const m = input.match(/^(\d+)([dhm])$/)
  if (m) {
    const n = parseInt(m[1], 10)
    const unit = m[2]
    const ms = unit === "d" ? n * 86400000 : unit === "h" ? n * 3600000 : n * 60000
    return new Date(Date.now() - ms)
  }
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) {
    throw new Error(`invalid --since value: ${input} (use "7d", "24h", or ISO date)`)
  }
  return d
}

function parseFlags(argv: string[]): Flags {
  const args = argv.slice(2)
  const positional = args.filter((a) => !a.startsWith("--"))
  const logPath = positional[0]
  if (!logPath) {
    throw new Error(
      "usage: bun run sync-tripwire <log-export.json> [--upload] [--since 7d|2026-04-20]",
    )
  }
  const upload = args.includes("--upload")
  const sinceIdx = args.indexOf("--since")
  const sinceRaw = sinceIdx >= 0 ? (args[sinceIdx + 1] ?? "7d") : "7d"
  return { logPath, upload, since: parseSince(sinceRaw), sinceRaw }
}

function readLogEvents(logPath: string, since: Date): TripwireEvent[] {
  const logs = JSON.parse(readFileSync(logPath, "utf8")) as LogEntry[]
  const events: TripwireEvent[] = []
  for (const l of logs) {
    if (l.type !== "middleware" || l.level !== "info" || !l.message) continue
    let ev: TripwireEvent
    try {
      ev = JSON.parse(l.message) as TripwireEvent
    } catch {
      continue
    }
    if (ev.event !== "tripwire.hit" && ev.event !== "tripwire.throttled") continue
    if (new Date(ev.ts) < since) continue
    events.push(ev)
  }
  return events
}

function readBlobTsSet(): Set<string> {
  const set = new Set<string>()
  const eventsDir = join(ROOT, "tripwire", "events")
  let dateDirs: string[]
  try {
    dateDirs = readdirSync(eventsDir)
  } catch {
    return set
  }
  for (const dateDir of dateDirs) {
    const dirPath = join(eventsDir, dateDir)
    let files: string[]
    try {
      files = readdirSync(dirPath)
    } catch {
      continue
    }
    for (const f of files) {
      if (!f.endsWith(".json")) continue
      try {
        const ev = JSON.parse(readFileSync(join(dirPath, f), "utf8")) as TripwireEvent
        if (ev.ts) set.add(ev.ts)
      } catch {
        // skip malformed
      }
    }
  }
  return set
}

function backfillPathname(event: TripwireEvent): string {
  const date = event.ts.slice(0, 10)
  const ms = new Date(event.ts).getTime()
  const hash = createHash("sha1").update(JSON.stringify(event)).digest("hex").slice(0, 6)
  return `tripwire/events/${date}/${ms}-bf-${hash}.json`
}

async function uploadOne(event: TripwireEvent): Promise<string> {
  const pathname = backfillPathname(event)
  await put(pathname, JSON.stringify(event), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  })
  return pathname
}

async function main(): Promise<void> {
  const { logPath, upload, since, sinceRaw } = parseFlags(process.argv)
  console.log(`[sync-tripwire] log=${logPath}`)
  console.log(`[sync-tripwire] since=${sinceRaw} → ${since.toISOString()}`)
  console.log(`[sync-tripwire] upload=${upload}`)
  console.log()

  console.log("[sync-tripwire] mirroring tripwire/ → scratch/blob/")
  const mirrorResult = await mirrorBlob({ prefix: "tripwire/", root: ROOT, silent: true })
  console.log(
    `  mirror: ${mirrorResult.downloaded} downloaded, ${mirrorResult.skipped} already present, ${mirrorResult.failed} failed`,
  )
  if (mirrorResult.failed > 0) {
    console.error("[sync-tripwire] mirror failures — aborting before diff")
    process.exit(1)
  }

  const blobTs = readBlobTsSet()
  const logEvents = readLogEvents(logPath, since)

  const missing: TripwireEvent[] = []
  for (const ev of logEvents) {
    if (!blobTs.has(ev.ts)) missing.push(ev)
  }

  console.log()
  console.log(`Logs (since ${since.toISOString()}):  ${logEvents.length} tripwire events`)
  console.log(`Blob:                                  ${blobTs.size} unique events (by ts)`)
  console.log(`Missing (in logs, not in blob):        ${missing.length}`)
  console.log()

  if (missing.length > 0) {
    console.log("--- Missing events ---")
    for (const ev of [...missing].sort((a, b) => a.ts.localeCompare(b.ts))) {
      const ua = ev.ua_family ?? "-"
      console.log(`  ${ev.ts}  ${ev.path.padEnd(20)}  ip=${ev.ip}  ua=${ua}`)
    }
    console.log()
  }

  if (!upload) {
    if (missing.length > 0) {
      console.log("Run again with --upload to backfill these.")
    } else {
      console.log("All log events present in blob storage.")
    }
    return
  }

  if (missing.length === 0) {
    console.log("Nothing to upload.")
    return
  }

  console.log(`[sync-tripwire] uploading ${missing.length} missing events`)
  let ok = 0
  let fail = 0
  for (const ev of missing) {
    try {
      const pathname = await uploadOne(ev)
      console.log(`  OK    ${pathname}`)
      ok++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  FAIL  ${ev.ts}: ${msg}`)
      fail++
    }
  }
  console.log()
  console.log(`Uploaded:  ${ok}`)
  console.log(`Failed:    ${fail}`)
  if (fail > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
