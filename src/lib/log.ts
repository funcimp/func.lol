// src/lib/log.ts
//
// Tiny structured logger. One `Logger` interface, one provider that
// writes JSON lines via console.log. Vercel auto-parses JSON in stdout
// into searchable fields in runtime logs and forwards the same to log
// drains, so this is the idiomatic shape for this platform.
//
// Why a wrapper at all instead of raw `console.log(JSON.stringify(...))`:
// the interface gives us levels, bound context (`child`), and a single
// place to swap implementations later (an HTTP drain, a no-op for tests,
// a prefixed logger for CLI scripts) without touching call sites.
//
// What this is not: it has no transports, no formatters, no redaction,
// no async I/O. If we ever need any of those, they're additive.

export type Level = "debug" | "info" | "warn" | "error" | "silent"

export interface Logger {
  debug(fields: Record<string, unknown>): void
  info(fields: Record<string, unknown>): void
  warn(fields: Record<string, unknown>): void
  error(fields: Record<string, unknown>): void
  child(bindings: Record<string, unknown>): Logger
}

const RANK: Record<Exclude<Level, "silent">, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

interface ConsoleLoggerOptions {
  level?: Level
  bindings?: Record<string, unknown>
}

export function consoleLogger(opts: ConsoleLoggerOptions = {}): Logger {
  const level = opts.level ?? "info"
  const bindings = opts.bindings ?? {}
  const threshold = level === "silent" ? Number.POSITIVE_INFINITY : RANK[level]

  function emit(name: Exclude<Level, "silent">, fields: Record<string, unknown>): void {
    if (RANK[name] < threshold) return
    console.log(
      JSON.stringify({
        time: new Date().toISOString(),
        level: name,
        ...bindings,
        ...fields,
      }),
    )
  }

  return {
    debug: (f) => emit("debug", f),
    info: (f) => emit("info", f),
    warn: (f) => emit("warn", f),
    error: (f) => emit("error", f),
    child: (b) => consoleLogger({ level, bindings: { ...bindings, ...b } }),
  }
}

function readLevel(): Level {
  // Default: quiet on production, debug everywhere else (preview, dev).
  // Crons run identical code in every environment, so a preview deploy
  // gets the per-step trace without needing a manual env var. LOG_LEVEL
  // overrides if set explicitly.
  const fallback = process.env.VERCEL_ENV === "production" ? "info" : "debug"
  const raw = (process.env.LOG_LEVEL ?? fallback).toLowerCase()
  if (
    raw === "debug" ||
    raw === "info" ||
    raw === "warn" ||
    raw === "error" ||
    raw === "silent"
  ) {
    return raw
  }
  return "info"
}

export const log: Logger = consoleLogger({ level: readLevel() })
