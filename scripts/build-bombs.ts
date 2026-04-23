// scripts/build-bombs.ts
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { buildBomb, type BombKind } from "../src/lib/tripwire/bomb"

const PRODUCTION_TARGET = 2_000_000_000 // ~2 GB decompressed
const PAYLOAD_TEXT = "nice try "
const KINDS: BombKind[] = ["html", "json", "yaml", "env"]

const publicDir = path.join(process.cwd(), "public")
const cachePath = path.join(publicDir, ".bomb-cache.txt")

function inputHash(): string {
  const input = JSON.stringify({
    version: 1,
    target: PRODUCTION_TARGET,
    payload: PAYLOAD_TEXT,
    kinds: KINDS,
  })
  return createHash("sha256").update(input).digest("hex")
}

function outputsExist(): boolean {
  return KINDS.every((k) => existsSync(path.join(publicDir, `.bomb.${k}.gz`)))
}

async function main() {
  mkdirSync(publicDir, { recursive: true })

  const hash = inputHash()
  if (existsSync(cachePath) && readFileSync(cachePath, "utf8").trim() === hash && outputsExist()) {
    console.log("[tripwire] build-bombs: inputs unchanged; skipping.")
    return
  }

  for (const kind of KINDS) {
    const start = Date.now()
    const bytes = await buildBomb({
      kind,
      targetDecompressedBytes: PRODUCTION_TARGET,
      payloadText: PAYLOAD_TEXT,
    })
    const outPath = path.join(publicDir, `.bomb.${kind}.gz`)
    writeFileSync(outPath, bytes)
    const ratio = (PRODUCTION_TARGET / bytes.length).toFixed(0)
    const ms = Date.now() - start
    console.log(
      `[tripwire] ${kind}: ${bytes.length.toLocaleString()} bytes (${ratio}:1) in ${ms} ms → ${outPath}`,
    )
  }

  writeFileSync(cachePath, hash + "\n")
  console.log("[tripwire] build-bombs: done.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
