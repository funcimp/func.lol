// src/lib/tripwire/bomb.test.ts
import { describe, test, expect } from "bun:test"
import { gunzipSync } from "node:zlib"
import { buildBomb, type BombKind } from "./bomb"

const TARGET = 4096
const TOLERANCE = 1024 // bomb size accurate to within 1 KB at this target

async function build(kind: BombKind): Promise<{ compressed: Uint8Array; body: string }> {
  const compressed = await buildBomb({ kind, targetDecompressedBytes: TARGET })
  const body = gunzipSync(compressed).toString("utf8")
  return { compressed, body }
}

describe("buildBomb", () => {
  test("html: body parses as HTML, payload inside <p> (not comment)", async () => {
    const { body } = await build("html")
    expect(body.startsWith("<!DOCTYPE html>")).toBe(true)
    expect(body).toContain("<body>")
    expect(body).toContain("<p>")
    expect(body).toContain("</p>")
    expect(body).toContain("</body>")
    expect(body).toContain("</html>")
    // Critical: payload must NOT be wrapped in a parse-skip comment
    expect(body).not.toMatch(/<!--[\s\S]*nice try/)
    expect(body).toContain("nice try")
  })

  test("json: body parses as JSON with nested payload", async () => {
    const { body } = await build("json")
    const parsed = JSON.parse(body)
    expect(typeof parsed).toBe("object")
    expect(parsed.error).toBe("not_found")
    expect(typeof parsed.note).toBe("string")
    expect(parsed.note).toContain("nice try")
  })

  test("yaml: body is a valid YAML literal block scalar", async () => {
    const { body } = await build("yaml")
    expect(body.startsWith("warning: |-")).toBe(true)
    expect(body).toContain("nice try")
  })

  test("env: body is KEY=VALUE plain text", async () => {
    const { body } = await build("env")
    expect(body).toMatch(/^[A-Z_]+=/m)
    expect(body).toContain("nice try")
  })

  test("decompressed size is within tolerance of target for each kind", async () => {
    for (const kind of ["html", "json", "yaml", "env"] as const) {
      const { body } = await build(kind)
      const size = Buffer.byteLength(body, "utf8")
      expect(size, `${kind} size`).toBeGreaterThanOrEqual(TARGET - TOLERANCE)
      expect(size, `${kind} size`).toBeLessThanOrEqual(TARGET + TOLERANCE)
    }
  })

  test("compressed bytes begin with gzip magic", async () => {
    for (const kind of ["html", "json", "yaml", "env"] as const) {
      const compressed = await buildBomb({ kind, targetDecompressedBytes: TARGET })
      expect(compressed[0], `${kind}[0]`).toBe(0x1f)
      expect(compressed[1], `${kind}[1]`).toBe(0x8b)
    }
  })

  test("custom payload text is used when provided", async () => {
    const compressed = await buildBomb({
      kind: "html",
      targetDecompressedBytes: TARGET,
      payloadText: "hello world ",
    })
    const body = gunzipSync(compressed).toString("utf8")
    expect(body).toContain("hello world")
    expect(body).not.toContain("nice try")
  })
})
