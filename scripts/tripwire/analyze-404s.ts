// scripts/tripwire/analyze-404s.ts
//
// Pull recent 404 responses from Vercel logs, group by path, and surface the
// paths that look scanner-y but aren't yet in src/lib/tripwire/patterns.ts.
// Useful for curating which new bait paths to add.
//
// The Vercel CLI doesn't expose UA or IP for 404 entries, so this is a path-
// only signal. It's still effective: if a path 404s a bunch of times, the
// path itself usually betrays scanner intent — /vendor/phpunit/..., /.env*,
// /wp-admin/various, etc.
//
// Usage:
//   just tripwire-analyze-404s                   # last 7d, default
//   just tripwire-analyze-404s --since 14d       # window override
//   just tripwire-analyze-404s --top 50          # cap output rows
//   just tripwire-analyze-404s --include-safe    # also show paths that hit our safe lists
//   just tripwire-analyze-404s --include-matched # also show paths that match a bait pattern
//
// Output groups paths into three buckets:
//   CANDIDATE — not in patterns.ts, not in safe list. These are the actionable
//               results: review and add interesting ones to PATTERNS.
//   SAFE      — path is in SAFE_PREFIXES/SAFE_EXACT_PATHS (favicon, /x/, etc.).
//               Hidden by default; pass --include-safe to see them.
//   MATCHED   — path matches a bait pattern, so it should have been served the
//               bomb (200), not 404. Seeing one of these is anomalous —
//               possibly a deploy gap or a pattern mismatch worth investigating.

import { fetchLogs, parseSince, capSince, type LogEntry } from "./lib/logs"
import {
  matchBait,
  SAFE_PREFIXES,
  SAFE_EXACT_PATHS,
} from "@/lib/tripwire/patterns"

const DEFAULT_SINCE = "7d"
const DEFAULT_LIMIT = 10000
const DEFAULT_TOP = 100

interface Flags {
  since: Date
  sinceRaw: string
  limit: number
  top: number
  includeSafe: boolean
  includeMatched: boolean
}

type Bucket = "CANDIDATE" | "SAFE" | "MATCHED"

interface PathStats {
  path: string
  count: number
  bucket: Bucket
  matchedToken: string | null
  firstSeen: number
  lastSeen: number
}

function parseFlags(argv: string[]): Flags {
  const args = argv.slice(2)
  const sinceIdx = args.indexOf("--since")
  const sinceRaw = sinceIdx >= 0 ? (args[sinceIdx + 1] ?? DEFAULT_SINCE) : DEFAULT_SINCE
  const since = capSince(parseSince(sinceRaw))
  const limitIdx = args.indexOf("--limit")
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1] ?? "0", 10) || DEFAULT_LIMIT : DEFAULT_LIMIT
  const topIdx = args.indexOf("--top")
  const top = topIdx >= 0 ? parseInt(args[topIdx + 1] ?? "0", 10) || DEFAULT_TOP : DEFAULT_TOP
  const includeSafe = args.includes("--include-safe")
  const includeMatched = args.includes("--include-matched")
  return { since, sinceRaw, limit, top, includeSafe, includeMatched }
}

function classify(path: string): { bucket: Bucket; matchedToken: string | null } {
  let url: URL
  try { url = new URL(path, "https://func.lol") } catch {
    return { bucket: "CANDIDATE", matchedToken: null }
  }
  const matched = matchBait(url)
  if (matched) return { bucket: "MATCHED", matchedToken: matched.token }
  const pathname = url.pathname
  if (SAFE_PREFIXES.some((p) => pathname.startsWith(p))) return { bucket: "SAFE", matchedToken: null }
  if (!url.search && SAFE_EXACT_PATHS.includes(pathname)) return { bucket: "SAFE", matchedToken: null }
  return { bucket: "CANDIDATE", matchedToken: null }
}

function aggregate(logs: LogEntry[]): PathStats[] {
  const map = new Map<string, PathStats>()
  for (const l of logs) {
    if (l.responseStatusCode !== 404) continue
    if (!l.requestPath) continue
    const path = l.requestPath
    let s = map.get(path)
    if (!s) {
      const { bucket, matchedToken } = classify(path)
      s = { path, count: 0, bucket, matchedToken, firstSeen: l.timestamp, lastSeen: l.timestamp }
      map.set(path, s)
    }
    s.count++
    if (l.timestamp < s.firstSeen) s.firstSeen = l.timestamp
    if (l.timestamp > s.lastSeen) s.lastSeen = l.timestamp
  }
  return [...map.values()]
}

function fmtTs(ms: number): string {
  return new Date(ms).toISOString().replace("T", " ").slice(0, 19) + "Z"
}

function printBucket(name: string, rows: PathStats[], top: number): void {
  if (rows.length === 0) {
    console.log(`(no ${name} rows)`)
    console.log()
    return
  }
  console.log(`=== ${name} (${rows.length}) ===`)
  const shown = rows.slice(0, top)
  for (const r of shown) {
    const tail = r.matchedToken ? `  matches: ${r.matchedToken}` : ""
    console.log(`  ${String(r.count).padStart(5)}×  ${r.path}${tail}`)
    console.log(`         first ${fmtTs(r.firstSeen)}   last ${fmtTs(r.lastSeen)}`)
  }
  if (rows.length > top) {
    console.log(`  … ${rows.length - top} more (use --top ${rows.length} to show all)`)
  }
  console.log()
}

function main(): void {
  const flags = parseFlags(process.argv)
  console.log(`[analyze-404s] since=${flags.sinceRaw} → ${flags.since.toISOString()}`)
  console.log(`[analyze-404s] limit=${flags.limit}, top=${flags.top}`)
  console.log()

  console.log("[analyze-404s] fetching 404 logs...")
  const logs = fetchLogs({
    since: flags.since,
    limit: flags.limit,
    statusCode: "404",
  })
  console.log(`[analyze-404s] fetched ${logs.length} log lines`)
  console.log()

  const all = aggregate(logs).sort((a, b) => b.count - a.count)

  const candidates = all.filter((s) => s.bucket === "CANDIDATE")
  const safe = all.filter((s) => s.bucket === "SAFE")
  const matched = all.filter((s) => s.bucket === "MATCHED")

  const totalHits = all.reduce((n, s) => n + s.count, 0)
  console.log(`Total 404 hits: ${totalHits}`)
  console.log(`Distinct paths: ${all.length}`)
  console.log(`  CANDIDATE: ${candidates.length}`)
  console.log(`  SAFE:      ${safe.length}`)
  console.log(`  MATCHED:   ${matched.length}  (anomaly: bait paths shouldn't 404)`)
  console.log()

  printBucket("CANDIDATE", candidates, flags.top)
  if (flags.includeMatched) printBucket("MATCHED (anomaly)", matched, flags.top)
  if (flags.includeSafe) printBucket("SAFE", safe, flags.top)
}

main()
