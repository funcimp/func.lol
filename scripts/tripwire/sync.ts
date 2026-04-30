// scripts/tripwire/sync.ts
//
// Idempotent diagnose-and-backfill tool for the tripwire bronze layer.
//
// Pipeline:
//   1. Determine since: --since flag → watermark → "7d" fallback. Cap at 14d.
//   2. Fetch logs from Vercel CLI (filter at fetch time via --query).
//   3. Parse messages, extract tripwire events. Dedupe by Vercel log id
//      (the CLI returns each entry many times).
//   4. Mirror events/ blob prefix locally.
//   5. Build dedup Set: req_id (when present) else log id (synthetic).
//   6. Diff: events in logs whose key is not in Set.
//   7. Print summary. With --upload, write each missing event to
//      events/<YYYY-MM-DD>/<ts-ms>-<id>.json with allowOverwrite:true.
//   8. On success, update watermark at sync-state.json.
//
// Usage:
//   bun run scripts/tripwire/sync.ts                          # diff only
//   bun run scripts/tripwire/sync.ts --upload                 # diff + backfill
//   bun run scripts/tripwire/sync.ts --since 24h              # custom window
//   bun run scripts/tripwire/sync.ts --since 2026-04-20       # absolute date
//   bun run scripts/tripwire/sync.ts --query "tripwire.hit"   # narrower CLI filter
//
// Reads BLOB_READ_WRITE_TOKEN from .env.local. Requires `vercel` CLI on PATH
// and an active `vercel login` session.

import { list, get, put } from "@vercel/blob"
import { spawnSync } from "node:child_process"
import { mkdir, writeFile, stat, readdir, readFile } from "node:fs/promises"
import { dirname, join } from "node:path"

const ROOT = join(process.cwd(), "scratch", "blob")
const EVENTS_DIR = join(ROOT, "events")
const WATERMARK_KEY = "sync-state.json"
const MAX_DAYS = 14
const DEFAULT_SINCE = "7d"

interface TripwireEvent {
  event: "tripwire.hit" | "tripwire.throttled"
  req_id?: string
  ts: string
  path: string
  pattern: string
  ip: string
  category?: string
  bomb?: string
  ua_raw?: string
  ua_family?: string
  query?: string
}

interface LogEntry {
  id: string
  timestamp: number
  level?: string
  message?: string
  source?: string
}

interface Watermark {
  lastTs: string
  lastRunAt: string
  counts?: { fetched: number; matched: number; uploaded: number }
}

interface Flags {
  upload: boolean
  since: Date
  sinceRaw: string
  sinceFromWatermark: boolean
  query: string
  source: string
  limit: number
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

function capSince(d: Date): Date {
  const earliest = new Date(Date.now() - MAX_DAYS * 86400000)
  return d < earliest ? earliest : d
}

async function readWatermark(): Promise<Watermark | null> {
  try {
    const { blobs } = await list({ prefix: WATERMARK_KEY, limit: 1 })
    const hit = blobs.find((b) => b.pathname === WATERMARK_KEY)
    if (!hit) return null
    const f = await get(hit.url, { access: "private" })
    if (!f || f.statusCode !== 200) return null
    const text = await new Response(f.stream).text()
    return JSON.parse(text) as Watermark
  } catch {
    return null
  }
}

async function writeWatermark(w: Watermark): Promise<void> {
  await put(WATERMARK_KEY, JSON.stringify(w, null, 2), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  })
}

async function parseFlags(argv: string[]): Promise<Flags> {
  const args = argv.slice(2)
  const upload = args.includes("--upload")

  const sinceFlagIdx = args.indexOf("--since")
  const sinceExplicit = sinceFlagIdx >= 0 ? args[sinceFlagIdx + 1] : null

  let sinceRaw: string
  let since: Date
  let sinceFromWatermark = false

  if (sinceExplicit) {
    sinceRaw = sinceExplicit
    since = parseSince(sinceExplicit)
  } else {
    const wm = await readWatermark()
    if (wm?.lastTs) {
      since = new Date(wm.lastTs)
      sinceRaw = `watermark:${wm.lastTs}`
      sinceFromWatermark = true
    } else {
      sinceRaw = DEFAULT_SINCE
      since = parseSince(DEFAULT_SINCE)
    }
  }
  since = capSince(since)

  const queryIdx = args.indexOf("--query")
  const query = queryIdx >= 0 ? (args[queryIdx + 1] ?? "tripwire") : "tripwire"

  const sourceIdx = args.indexOf("--source")
  const source = sourceIdx >= 0 ? (args[sourceIdx + 1] ?? "serverless") : "serverless"

  const limitIdx = args.indexOf("--limit")
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1] ?? "10000", 10) : 10000

  return { upload, since, sinceRaw, sinceFromWatermark, query, source, limit }
}

// vercel logs --json --no-follow streams data but doesn't always close cleanly
// once the data is dumped. We set a hard timeout so spawnSync sends SIGTERM
// after the CLI has had enough time to flush stdout. Anything in stdout at
// that point is parsed as JSONL.
const CLI_TIMEOUT_MS = 120_000

function fetchLogs(flags: Flags): LogEntry[] {
  const cliArgs = [
    "logs",
    "--json",
    "--no-follow",
    "--no-branch",
    "--environment", "production",
    "--source", flags.source,
    "--since", flags.since.toISOString(),
    "--limit", String(flags.limit),
    "--query", flags.query,
  ]
  const result = spawnSync("vercel", cliArgs, {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    timeout: CLI_TIMEOUT_MS,
  })
  // SIGTERM via timeout is the expected exit path here; treat partial stdout as data.
  if (result.error && (result.error as NodeJS.ErrnoException).code !== "ETIMEDOUT") {
    throw result.error
  }
  if (result.status !== 0 && result.status !== null) {
    // null means killed by signal (timeout). Anything else is a real error
    // unless we have stdout.
    if (!result.stdout) {
      throw new Error(`vercel logs failed (status=${result.status}): ${result.stderr}`)
    }
  }
  const lines = (result.stdout ?? "").split("\n").filter(Boolean)
  const out: LogEntry[] = []
  for (const line of lines) {
    try { out.push(JSON.parse(line) as LogEntry) } catch { /* skip */ }
  }
  return out
}

function extractTripwireEvents(logs: LogEntry[]): Array<{ event: TripwireEvent; logId: string; logTs: number }> {
  const seen = new Set<string>()
  const out: Array<{ event: TripwireEvent; logId: string; logTs: number }> = []
  for (const l of logs) {
    if (l.level !== "info" || !l.message) continue
    if (seen.has(l.id)) continue
    let ev: TripwireEvent
    try { ev = JSON.parse(l.message) as TripwireEvent } catch { continue }
    if (ev.event !== "tripwire.hit" && ev.event !== "tripwire.throttled") continue
    seen.add(l.id)
    out.push({ event: ev, logId: l.id, logTs: l.timestamp })
  }
  return out
}

async function localSize(path: string): Promise<number | null> {
  try { return (await stat(path)).size } catch { return null }
}

async function mirrorEvents(): Promise<{ downloaded: number; skipped: number; failed: number }> {
  let cursor: string | undefined
  let downloaded = 0; let skipped = 0; let failed = 0
  do {
    const page = await list({ prefix: "events/", cursor })
    for (const blob of page.blobs) {
      const localPath = join(ROOT, blob.pathname)
      if ((await localSize(localPath)) === blob.size) { skipped++; continue }
      try {
        const f = await get(blob.url, { access: "private" })
        if (!f || f.statusCode !== 200) throw new Error(`statusCode=${f?.statusCode}`)
        const buf = Buffer.from(await new Response(f.stream).arrayBuffer())
        await mkdir(dirname(localPath), { recursive: true })
        await writeFile(localPath, buf)
        downloaded++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`  mirror FAIL ${blob.pathname}: ${msg}`)
        failed++
      }
    }
    cursor = page.cursor
  } while (cursor)
  return { downloaded, skipped, failed }
}

// Extract dedup id from a local blob file. Prefer event.req_id (when present
// in content); fall back to the id segment of the filename. Filename is
// `<ts-ms>-<id>.json`; id can contain any chars except `/` and `.`.
async function readBlobKeys(): Promise<Set<string>> {
  const keys = new Set<string>()
  let dirs: string[]
  try { dirs = await readdir(EVENTS_DIR) } catch { return keys }
  for (const d of dirs) {
    const dirPath = join(EVENTS_DIR, d)
    let files: string[]
    try { files = await readdir(dirPath) } catch { continue }
    for (const f of files) {
      if (!f.endsWith(".json")) continue
      try {
        const text = await readFile(join(dirPath, f), "utf8")
        const ev = JSON.parse(text) as TripwireEvent
        const fromContent = ev.req_id
        const fromFilename = f.replace(/\.json$/, "").replace(/^\d+-/, "")
        keys.add(fromContent ?? fromFilename)
      } catch { /* skip malformed */ }
    }
  }
  return keys
}

function backfillPathname(event: TripwireEvent, fallbackId: string): string {
  const date = event.ts.slice(0, 10)
  const ms = new Date(event.ts).getTime()
  const id = event.req_id ?? fallbackId
  return `events/${date}/${ms}-${id}.json`
}

async function uploadOne(event: TripwireEvent, fallbackId: string): Promise<string> {
  const pathname = backfillPathname(event, fallbackId)
  await put(pathname, JSON.stringify(event), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  })
  return pathname
}

async function main(): Promise<void> {
  const flags = await parseFlags(process.argv)

  console.log(`[sync-tripwire] since=${flags.sinceRaw} → ${flags.since.toISOString()}${flags.sinceFromWatermark ? " (from watermark)" : ""}`)
  console.log(`[sync-tripwire] upload=${flags.upload}, query="${flags.query}", source=${flags.source}, limit=${flags.limit}`)
  console.log()

  console.log("[sync-tripwire] fetching logs...")
  const rawLogs = fetchLogs(flags)
  const events = extractTripwireEvents(rawLogs)
  console.log(`[sync-tripwire] fetched ${rawLogs.length} log lines, ${events.length} unique tripwire events`)
  console.log()

  console.log("[sync-tripwire] mirroring events/ blob prefix...")
  const mr = await mirrorEvents()
  console.log(`[sync-tripwire] mirror: ${mr.downloaded} downloaded, ${mr.skipped} skipped, ${mr.failed} failed`)
  if (mr.failed > 0) { console.error("[sync-tripwire] mirror failures — aborting"); process.exit(1) }

  const blobKeys = await readBlobKeys()
  console.log(`[sync-tripwire] blob: ${blobKeys.size} unique events`)
  console.log()

  const missing = events.filter((e) => {
    const key = e.event.req_id ?? e.logId
    return !blobKeys.has(key)
  })

  console.log(`Logs:    ${events.length}`)
  console.log(`Blob:    ${blobKeys.size}`)
  console.log(`Missing: ${missing.length}`)
  console.log()

  if (missing.length > 0) {
    console.log("--- Missing events ---")
    for (const m of [...missing].sort((a, b) => a.event.ts.localeCompare(b.event.ts))) {
      const ua = m.event.ua_family ?? "-"
      console.log(`  ${m.event.ts}  ${m.event.path.padEnd(28)}  ip=${m.event.ip}  ua=${ua}`)
    }
    console.log()
  }

  let uploaded = 0; let failed = 0
  if (flags.upload && missing.length > 0) {
    console.log(`[sync-tripwire] uploading ${missing.length} missing events`)
    for (const m of missing) {
      try {
        const pathname = await uploadOne(m.event, m.logId)
        console.log(`  OK    ${pathname}`)
        uploaded++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`  FAIL  ${m.event.ts}: ${msg}`)
        failed++
      }
    }
    console.log()
    console.log(`Uploaded: ${uploaded}, Failed: ${failed}`)
  } else if (missing.length > 0) {
    console.log("Run again with --upload to backfill these.")
  } else {
    console.log("All log events present in blob storage.")
  }

  // Update watermark only on full success (or no upload requested).
  if (failed === 0 && events.length > 0) {
    const lastTs = events
      .map((e) => e.event.ts)
      .sort()
      .at(-1)!
    await writeWatermark({
      lastTs,
      lastRunAt: new Date().toISOString(),
      counts: { fetched: events.length, matched: events.length - missing.length, uploaded },
    })
    console.log(`[sync-tripwire] watermark advanced to ${lastTs}`)
  }

  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
