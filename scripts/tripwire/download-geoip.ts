// scripts/tripwire/download-geoip.ts
//
// Downloads MaxMind GeoLite2-ASN to data/GeoLite2-ASN.mmdb. Used by the
// tripwire stats aggregator for offline IP → ASN enrichment.
//
// Reads MAXMIND_ACCOUNT_ID and MAXMIND_LICENSE_KEY from .env.local (bun
// auto-loads). Skips download if the .mmdb is already present and was
// modified recently (configurable via --max-age-days, default 7) — MaxMind
// updates GeoLite2 weekly, so a daily prebuild doesn't need to re-fetch.
//
// Usage:
//   bun run scripts/tripwire/download-geoip.ts                # download if stale
//   bun run scripts/tripwire/download-geoip.ts --force        # always download
//   bun run scripts/tripwire/download-geoip.ts --max-age-days 30
//
// Output: data/GeoLite2-ASN.mmdb
//
// MaxMind's permalink for the database (per their account portal):
//   https://download.maxmind.com/geoip/databases/GeoLite2-ASN/download?suffix=tar.gz
// Authenticated via HTTP Basic with account-id:license-key.

import { spawnSync } from "node:child_process"
import { copyFile, mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

const DOWNLOAD_URL =
  "https://download.maxmind.com/geoip/databases/GeoLite2-ASN/download?suffix=tar.gz"
const TARGET_DIR = join(process.cwd(), "data")
const TARGET_PATH = join(TARGET_DIR, "GeoLite2-ASN.mmdb")
const DEFAULT_MAX_AGE_DAYS = 7

interface Flags {
  force: boolean
  maxAgeDays: number
}

function parseFlags(argv: string[]): Flags {
  const args = argv.slice(2)
  const force = args.includes("--force")
  const idx = args.indexOf("--max-age-days")
  const raw = idx >= 0 ? args[idx + 1] : undefined
  const maxAgeDays = raw ? parseInt(raw, 10) || DEFAULT_MAX_AGE_DAYS : DEFAULT_MAX_AGE_DAYS
  return { force, maxAgeDays }
}

async function fileAgeMs(path: string): Promise<number | null> {
  try {
    const s = await stat(path)
    return Date.now() - s.mtimeMs
  } catch {
    return null
  }
}

async function downloadTarball(url: string, accountId: string, licenseKey: string): Promise<Buffer> {
  const auth = Buffer.from(`${accountId}:${licenseKey}`).toString("base64")
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`MaxMind download failed: ${res.status} ${res.statusText} — ${body.slice(0, 200)}`)
  }
  return Buffer.from(await res.arrayBuffer())
}

async function extractMmdb(tarballPath: string, extractDir: string): Promise<string> {
  // Tarball structure: GeoLite2-ASN_<YYYYMMDD>/GeoLite2-ASN.mmdb
  const result = spawnSync("tar", ["-xzf", tarballPath, "-C", extractDir], { encoding: "utf8" })
  if (result.status !== 0) {
    throw new Error(`tar extraction failed (status=${result.status}): ${result.stderr}`)
  }
  // Find the .mmdb file in any subdirectory
  const entries = await readdir(extractDir)
  for (const entry of entries) {
    const candidate = join(extractDir, entry, "GeoLite2-ASN.mmdb")
    try {
      await stat(candidate)
      return candidate
    } catch {
      // not here, keep looking
    }
  }
  throw new Error(`GeoLite2-ASN.mmdb not found in extracted tarball`)
}

async function moveFile(src: string, dst: string): Promise<void> {
  // copyFile works across filesystems (rename does not), and the source
  // tmp dir is rm'd by the caller so we don't need an explicit unlink.
  await copyFile(src, dst)
}

async function main(): Promise<void> {
  const { force, maxAgeDays } = parseFlags(process.argv)

  if (!force) {
    const ageMs = await fileAgeMs(TARGET_PATH)
    if (ageMs !== null && ageMs < maxAgeDays * 86400000) {
      const ageDays = Math.floor(ageMs / 86400000)
      console.log(`[geoip] ${TARGET_PATH} is ${ageDays}d old (< ${maxAgeDays}d), skipping. Use --force to redownload.`)
      return
    }
  }

  const accountId = process.env.MAXMIND_ACCOUNT_ID
  const licenseKey = process.env.MAXMIND_LICENSE_KEY
  if (!accountId || !licenseKey) {
    // CI builds have no MaxMind creds and don't need the .mmdb to run unit
    // tests or the dev server. Warn and exit cleanly so prebuild keeps
    // running. Only Vercel production builds (where the env vars are set)
    // actually populate the file for the cron route's outputFileTracingIncludes.
    console.warn("[geoip] MAXMIND_ACCOUNT_ID / MAXMIND_LICENSE_KEY not set; skipping download.")
    return
  }

  console.log(`[geoip] downloading GeoLite2-ASN from MaxMind...`)
  const tarball = await downloadTarball(DOWNLOAD_URL, accountId, licenseKey)
  console.log(`[geoip] downloaded ${tarball.length} bytes`)

  await mkdir(TARGET_DIR, { recursive: true })
  const tmp = await mkdtemp(join(tmpdir(), "geolite2-asn-"))
  try {
    const tarballPath = join(tmp, "GeoLite2-ASN.tar.gz")
    await writeFile(tarballPath, tarball)
    const mmdbPath = await extractMmdb(tarballPath, tmp)
    await moveFile(mmdbPath, TARGET_PATH)
    const finalSize = (await stat(TARGET_PATH)).size
    console.log(`[geoip] wrote ${TARGET_PATH} (${finalSize} bytes)`)
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
