// src/lib/tripwire/bomb.ts
import { createGzip } from "node:zlib"

export type { BombKind } from "./patterns"
import type { BombKind } from "./patterns"

export interface BuildBombOptions {
  kind: BombKind
  targetDecompressedBytes: number
  payloadText?: string
}

interface Skeleton {
  head: string
  tail: string
  indentPayload: (payload: string) => string
}

const SKELETONS: Record<BombKind, Skeleton> = {
  html: {
    head: '<!DOCTYPE html><html><head><meta charset="utf-8"><title>404</title></head><body><p>',
    tail: "</p></body></html>",
    indentPayload: (p) => p,
  },
  json: {
    head: '{"error":"not_found","note":"',
    tail: '"}',
    indentPayload: (p) => p.replace(/\\/g, "\\\\").replace(/"/g, '\\"'),
  },
  yaml: {
    head: "warning: |-\n  ",
    tail: "\n",
    indentPayload: (p) => p.replace(/\n/g, "\n  "),
  },
  env: {
    head: "DB_PASSWORD=",
    tail: "\n",
    indentPayload: (p) => p.replace(/\n/g, ""),
  },
}

export const DEFAULT_PAYLOAD = "nice try "

// Cap the in-memory chunk size so large targets don't spike V8/JSC heap.
// 100_000 repeats of a ~9-byte payload is <1 MB per chunk; adjust if the
// default payload grows.
const CHUNK_REPEATS = 100_000

export async function buildBomb(opts: BuildBombOptions): Promise<Uint8Array> {
  const payloadText = opts.payloadText ?? DEFAULT_PAYLOAD
  if (payloadText.includes("\n") || payloadText.includes("\r")) {
    throw new Error("buildBomb: payloadText must not contain newline characters")
  }
  const skeleton = SKELETONS[opts.kind]

  const overhead = Buffer.byteLength(skeleton.head + skeleton.tail, "utf8")
  const payloadBudget = Math.max(0, opts.targetDecompressedBytes - overhead)
  const payloadUnitLen = Buffer.byteLength(payloadText, "utf8")
  const totalRepeats = Math.floor(payloadBudget / payloadUnitLen)

  const gzip = createGzip({ level: 9 })
  const chunks: Buffer[] = []
  gzip.on("data", (chunk: Buffer) => chunks.push(chunk))
  const done = new Promise<void>((resolve, reject) => {
    gzip.on("end", resolve)
    gzip.on("error", reject)
  })

  gzip.write(skeleton.head)

  // Precompute one cached chunk, reuse it across the full-chunk iterations.
  // payloadText is newline-free (enforced above), so indentPayload is
  // deterministic per-chunk.
  const fullChunkCount = Math.floor(totalRepeats / CHUNK_REPEATS)
  const partialRepeats = totalRepeats % CHUNK_REPEATS

  if (fullChunkCount > 0) {
    const fullChunkText = skeleton.indentPayload(payloadText.repeat(CHUNK_REPEATS))
    for (let i = 0; i < fullChunkCount; i++) {
      gzip.write(fullChunkText)
    }
  }
  if (partialRepeats > 0) {
    gzip.write(skeleton.indentPayload(payloadText.repeat(partialRepeats)))
  }

  gzip.write(skeleton.tail)
  gzip.end()

  await done
  return Buffer.concat(chunks)
}
