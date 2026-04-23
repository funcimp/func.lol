// src/lib/tripwire/bomb.ts
import { gzipSync } from "node:zlib"

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

export async function buildBomb(opts: BuildBombOptions): Promise<Uint8Array> {
  const payloadText = opts.payloadText ?? "nice try "
  const skeleton = SKELETONS[opts.kind]

  const overhead = Buffer.byteLength(skeleton.head + skeleton.tail, "utf8")
  const payloadBudget = Math.max(0, opts.targetDecompressedBytes - overhead)
  const payloadUnitLen = Buffer.byteLength(payloadText, "utf8")
  const repeats = Math.floor(payloadBudget / payloadUnitLen)

  const payload = skeleton.indentPayload(payloadText.repeat(repeats))
  const body = skeleton.head + payload + skeleton.tail

  return gzipSync(Buffer.from(body, "utf8"), { level: 9 })
}
