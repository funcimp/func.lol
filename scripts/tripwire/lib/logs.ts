// scripts/tripwire/lib/logs.ts
//
// Shared helpers for tripwire ops scripts that pull logs via the Vercel CLI
// or read a manual dashboard JSON export.
//
// The CLI's `vercel logs --json --no-follow` doesn't always exit cleanly even
// when there's no more data to send, so callers that block on it need a hard
// timeout. We set one here and treat partial stdout as the data set.
//
// The CLI also has a hard-to-pin retrieval limit that varies by query — for
// the same `--query` over `--since 14d`, only the most recent ~3 days of
// data come back regardless of timeout/limit. Older events are reachable
// only through the dashboard export. readExportFile() normalizes export
// entries into the same LogEntry shape so consumers don't care about source.

import { readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"

export interface LogEntry {
  id: string
  timestamp: number
  level?: string
  message?: string
  source?: string
  requestPath?: string
  requestMethod?: string
  responseStatusCode?: number
  domain?: string
}

export interface FetchLogsOptions {
  since: Date
  limit: number
  query?: string
  source?: string
  statusCode?: string  // e.g. "404", "4xx"
  timeoutMs?: number
}

export const MAX_DAYS = 14
export const DEFAULT_CLI_TIMEOUT_MS = 120_000

export function parseSince(input: string): Date {
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

export function capSince(d: Date, maxDays: number = MAX_DAYS): Date {
  const earliest = new Date(Date.now() - maxDays * 86400000)
  return d < earliest ? earliest : d
}

export function fetchLogs(opts: FetchLogsOptions): LogEntry[] {
  const cliArgs = [
    "logs",
    "--json",
    "--no-follow",
    "--no-branch",
    "--environment", "production",
    "--since", opts.since.toISOString(),
    "--limit", String(opts.limit),
  ]
  if (opts.source) cliArgs.push("--source", opts.source)
  if (opts.query) cliArgs.push("--query", opts.query)
  if (opts.statusCode) cliArgs.push("--status-code", opts.statusCode)

  const result = spawnSync("vercel", cliArgs, {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    timeout: opts.timeoutMs ?? DEFAULT_CLI_TIMEOUT_MS,
  })

  // SIGTERM via timeout is the expected exit path; treat partial stdout as data.
  if (result.error && (result.error as NodeJS.ErrnoException).code !== "ETIMEDOUT") {
    throw result.error
  }
  if (result.status !== 0 && result.status !== null && !result.stdout) {
    throw new Error(`vercel logs failed (status=${result.status}): ${result.stderr}`)
  }

  const lines = (result.stdout ?? "").split("\n").filter(Boolean)
  const out: LogEntry[] = []
  for (const line of lines) {
    try { out.push(JSON.parse(line) as LogEntry) } catch { /* skip */ }
  }
  return out
}

// Vercel dashboard export JSON entry shape. Field names differ from the CLI
// (requestId vs id, timestampInMs vs timestamp, type vs source) so we
// normalize into LogEntry.
interface ExportEntry {
  requestId?: string
  timestampInMs?: number
  level?: string
  message?: string
  type?: string
  requestPath?: string
  requestMethod?: string
  responseStatusCode?: number
}

export function readExportFile(path: string): LogEntry[] {
  const raw = readFileSync(path, "utf8")
  const arr = JSON.parse(raw) as ExportEntry[]
  const out: LogEntry[] = []
  for (const e of arr) {
    if (!e.requestId || typeof e.timestampInMs !== "number") continue
    out.push({
      id: e.requestId,
      timestamp: e.timestampInMs,
      level: e.level,
      message: e.message,
      source: e.type,
      requestPath: e.requestPath,
      requestMethod: e.requestMethod,
      responseStatusCode: e.responseStatusCode,
    })
  }
  return out
}
