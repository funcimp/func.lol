import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { buildBomb } from "../src/lib/tripwire/bomb"
import { BOMB_KINDS } from "../src/lib/tripwire/patterns"

// Before Playwright starts the dev server, generate tiny (~4 KB decompressed)
// bomb files so the proxy has something to stream without blowing up test
// memory on decompression. Overwrites any prod bombs from `bun run
// build-bombs`; the prebuild step will regenerate real bombs on the next
// `bun run build`.
export default async function globalSetup() {
  const dir = path.join(process.cwd(), "public")
  mkdirSync(dir, { recursive: true })

  for (const kind of BOMB_KINDS) {
    const bytes = await buildBomb({ kind, targetDecompressedBytes: 4096 })
    writeFileSync(path.join(dir, `.bomb.${kind}.gz`), bytes)
  }

  // Invalidate the build-bombs cache so the next `bun run build` does not
  // skip regeneration (the tiny bombs are NOT what we want to ship).
  rmSync(path.join(dir, ".bomb-cache.txt"), { force: true })
}
