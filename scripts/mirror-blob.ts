// scripts/mirror-blob.ts
//
// Mirror Vercel Blob storage to scratch/blob/ for local analysis.
// scratch/ is gitignored. Re-run as needed; existing local files of
// matching size are skipped.
//
// Default prefix is "tripwire/". Pass an alternate prefix as an argument:
//
//   bun run mirror-blob              # mirrors tripwire/
//   bun run mirror-blob foo/bar/     # mirrors a different prefix
//
// Reads BLOB_READ_WRITE_TOKEN from .env.local (bun auto-loads).

import { list, get } from "@vercel/blob"
import { mkdir, writeFile, stat } from "node:fs/promises"
import { dirname, join } from "node:path"

const PREFIX = process.argv[2] ?? "tripwire/"
const ROOT = join(process.cwd(), "scratch", "blob")

async function localSize(path: string): Promise<number | null> {
  try {
    return (await stat(path)).size
  } catch {
    return null
  }
}

async function downloadOne(url: string, localPath: string): Promise<void> {
  const file = await get(url, { access: "private" })
  if (!file || file.statusCode !== 200) {
    throw new Error(`statusCode=${file?.statusCode ?? "no-response"}`)
  }
  const buf = Buffer.from(await new Response(file.stream).arrayBuffer())
  await mkdir(dirname(localPath), { recursive: true })
  await writeFile(localPath, buf)
}

async function main(): Promise<void> {
  console.log(`[mirror] prefix=${PREFIX} → ${ROOT}`)
  let cursor: string | undefined
  let total = 0
  let downloaded = 0
  let skipped = 0
  let failed = 0

  do {
    const page = await list({ prefix: PREFIX, cursor })
    for (const blob of page.blobs) {
      total++
      const localPath = join(ROOT, blob.pathname)
      if ((await localSize(localPath)) === blob.size) {
        skipped++
        continue
      }
      try {
        await downloadOne(blob.url, localPath)
        downloaded++
        process.stdout.write(`  OK    ${blob.pathname}\n`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`  FAIL  ${blob.pathname}: ${msg}`)
        failed++
      }
    }
    cursor = page.cursor
  } while (cursor)

  console.log()
  console.log(`Total found:  ${total}`)
  console.log(`Downloaded:   ${downloaded}`)
  console.log(`Skipped:      ${skipped}  (already present, matching size)`)
  console.log(`Failed:       ${failed}`)

  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
