// scripts/build-bombs.ts
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { buildBomb, DEFAULT_PAYLOAD } from "../src/lib/tripwire/bomb"
import { BOMB_KINDS } from "../src/lib/tripwire/patterns"

const PRODUCTION_TARGET = 2_000_000_000 // ~2 GB decompressed
const PAYLOAD_TEXT = DEFAULT_PAYLOAD

const publicDir = path.join(process.cwd(), "public")
const cachePath = path.join(publicDir, ".bomb-cache.txt")

function inputHash(): string {
  const bombSourcePath = path.join(process.cwd(), "src/lib/tripwire/bomb.ts")
  const bombSource = readFileSync(bombSourcePath, "utf8")
  const input = JSON.stringify({
    version: 1,
    target: PRODUCTION_TARGET,
    payload: PAYLOAD_TEXT,
    kinds: BOMB_KINDS,
    bombSource,
  })
  return createHash("sha256").update(input).digest("hex")
}

function outputsExist(): boolean {
  return BOMB_KINDS.every((k) => existsSync(path.join(publicDir, `.bomb.${k}.gz`)))
}

async function main() {
  mkdirSync(publicDir, { recursive: true })

  const hash = inputHash()
  if (!existsSync(cachePath)) {
    console.log("[tripwire] build-bombs: no cache file; building all.")
  } else if (readFileSync(cachePath, "utf8").trim() !== hash) {
    console.log("[tripwire] build-bombs: input hash changed; rebuilding.")
  } else if (!outputsExist()) {
    console.log("[tripwire] build-bombs: outputs missing; rebuilding.")
  } else {
    console.log("[tripwire] build-bombs: inputs unchanged; skipping.")
    return
  }

  for (const kind of BOMB_KINDS) {
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
