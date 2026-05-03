// src/lib/log.test.ts
import { describe, test, expect, mock } from "bun:test"
import { consoleLogger } from "./log"

function captureConsole(): { lines: unknown[][]; restore: () => void } {
  const lines: unknown[][] = []
  const original = console.log
  const spy = mock((...args: unknown[]) => {
    lines.push(args)
  })
  console.log = spy
  return { lines, restore: () => { console.log = original } }
}

describe("consoleLogger", () => {
  test("emits one JSON line per call with time + level + fields", () => {
    const { lines, restore } = captureConsole()
    try {
      const log = consoleLogger({ level: "debug" })
      log.info({ event: "boot", step: "ok" })
      expect(lines).toHaveLength(1)
      expect(lines[0]).toHaveLength(1)
      const record = JSON.parse(lines[0][0] as string)
      expect(record.level).toBe("info")
      expect(record.event).toBe("boot")
      expect(record.step).toBe("ok")
      expect(typeof record.time).toBe("string")
      expect(Number.isNaN(Date.parse(record.time))).toBe(false)
    } finally {
      restore()
    }
  })

  test("filters records below the threshold", () => {
    const { lines, restore } = captureConsole()
    try {
      const log = consoleLogger({ level: "warn" })
      log.debug({ x: 1 })
      log.info({ x: 2 })
      log.warn({ x: 3 })
      log.error({ x: 4 })
      const levels = lines.map((l) => JSON.parse(l[0] as string).level)
      expect(levels).toEqual(["warn", "error"])
    } finally {
      restore()
    }
  })

  test("silent mutes everything", () => {
    const { lines, restore } = captureConsole()
    try {
      const log = consoleLogger({ level: "silent" })
      log.error({ x: 1 })
      expect(lines).toHaveLength(0)
    } finally {
      restore()
    }
  })

  test("child merges bindings; later bindings win on key collision", () => {
    const { lines, restore } = captureConsole()
    try {
      const root = consoleLogger({ level: "debug", bindings: { service: "tripwire", env: "test" } })
      const child = root.child({ event: "cron.ingest", env: "prod" })
      child.info({ step: "start" })
      const record = JSON.parse(lines[0][0] as string)
      expect(record.service).toBe("tripwire")
      expect(record.event).toBe("cron.ingest")
      expect(record.env).toBe("prod")
      expect(record.step).toBe("start")
    } finally {
      restore()
    }
  })

  test("call-site fields override parent + child bindings", () => {
    const { lines, restore } = captureConsole()
    try {
      const log = consoleLogger({ level: "debug", bindings: { event: "from-root" } }).child({
        event: "from-child",
      })
      log.info({ event: "from-call" })
      const record = JSON.parse(lines[0][0] as string)
      expect(record.event).toBe("from-call")
    } finally {
      restore()
    }
  })

  test("child inherits the parent level", () => {
    const { lines, restore } = captureConsole()
    try {
      const log = consoleLogger({ level: "warn" }).child({ scope: "x" })
      log.info({ skip: true })
      log.warn({ keep: true })
      expect(lines).toHaveLength(1)
      expect(JSON.parse(lines[0][0] as string).keep).toBe(true)
    } finally {
      restore()
    }
  })
})
